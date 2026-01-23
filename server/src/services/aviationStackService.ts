import axios from 'axios';
import { CacheService } from './cacheService.js';
import { logger } from '../logger.js';
import type { FlightRouteInfo } from '@vr-flight-tracker/shared';

interface AviationStackResponse {
  data?: Array<{
    flight_date?: string;
    flight_status?: string;
    flight?: {
      number?: string;
      iata?: string;
      icao?: string;
      codeshared?: {
        airline_name?: string;
        airline_iata?: string;
        airline_icao?: string;
        flight_number?: string;
        flight_iata?: string;
        flight_icao?: string;
      } | null;
    } | null;
    departure?: {
      airport?: string;
      timezone?: string;
      iata?: string;
      icao?: string;
      terminal?: string;
      gate?: string;
      delay?: number | null;
      scheduled?: string | null;
      estimated?: string | null;
      actual?: string | null;
      estimated_runway?: string | null;
      actual_runway?: string | null;
    } | null;
    arrival?: {
      airport?: string;
      timezone?: string;
      iata?: string;
      icao?: string;
      terminal?: string;
      gate?: string;
      baggage?: string;
      delay?: number | null;
      scheduled?: string | null;
      estimated?: string | null;
      actual?: string | null;
      estimated_runway?: string | null;
      actual_runway?: string | null;
    } | null;
    airline?: {
      name?: string;
      iata?: string;
      icao?: string;
    } | null;
    aircraft?: {
      registration?: string;
      iata?: string;
      icao?: string;
      icao24?: string;
    } | null;
  }>;
  error?: {
    message?: string;
    code?: number;
    type?: string;
  };
}

interface AviationStackServiceOptions {
  ttlSeconds?: number;
  baseUrl?: string;
}

interface CallsignParts {
  airlineIcao: string;
  number: string;
  numberTrimmed: string;
  suffix: string;
}

interface LookupAttempt {
  description: string;
  params: Record<string, string>;
}

export class AviationStackService {
  private readonly cachePrefix = 'aviationstack_route';
  private readonly apiKey: string | undefined;
  private readonly cacheTtl: number;
  private readonly baseUrl: string;

  constructor(
    private readonly cacheService: CacheService,
    options?: AviationStackServiceOptions
  ) {
    this.apiKey = process.env.AVIATIONSTACK_API_KEY;
    this.cacheTtl = options?.ttlSeconds ?? 300;
    this.baseUrl =
      options?.baseUrl ?? process.env.AVIATIONSTACK_API_URL ?? 'http://api.aviationstack.com/v1';
  }

  async getRouteByCallsign(callsign: string): Promise<FlightRouteInfo | null> {
    const normalizedCallsign = this.normalizeCallsign(callsign);

    if (!normalizedCallsign) {
      logger.debug('AviationStack skipped empty callsign lookup');
      return null;
    }

    if (!this.apiKey) {
      logger.info('AviationStack API key missing - skipping origin/destination lookup');
      return null;
    }

    const cacheKey = `${this.cachePrefix}_${normalizedCallsign}`;
    const cached = this.cacheService.get<FlightRouteInfo | null>(cacheKey);
    if (cached !== undefined) {
      logger.debug('AviationStack cache hit', { callsign: normalizedCallsign });
      return cached;
    }

    const attempts = this.buildLookupAttempts(normalizedCallsign);

    for (const attempt of attempts) {
      try {
        logger.action(
          'AviationStack request',
          `Fetching route for ${normalizedCallsign} (${attempt.description})`
        );

        const response = await axios.get<AviationStackResponse>(`${this.baseUrl}/flights`, {
          timeout: 10000,
          params: {
            access_key: this.apiKey,
            limit: 1,
            ...attempt.params,
          },
        });

        const parsed = this.parseResponse(response.data, normalizedCallsign);
        if (parsed) {
          this.cacheService.set(cacheKey, parsed, this.cacheTtl);
          return parsed;
        }

        logger.debug('AviationStack attempt returned no data', {
          callsign: normalizedCallsign,
          attempt: attempt.description,
        });
      } catch (error) {
        logger.error(
          'E-AVI-002',
          `AviationStack attempt failed for ${normalizedCallsign} (${attempt.description})`,
          error
        );
      }
    }

    logger.debug('AviationStack no route after attempts', { callsign: normalizedCallsign });
    this.cacheService.set(cacheKey, null, this.cacheTtl);
    return null;
  }

  private normalizeCallsign(callsign: string): string {
    return callsign.replace(/\s+/g, '').toUpperCase();
  }

  private buildLookupAttempts(callsign: string): LookupAttempt[] {
    const attempts: LookupAttempt[] = [];
    const dedupe = new Set<string>();

    const pushAttempt = (description: string, params: Record<string, string>) => {
      const key = `${description}|${Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|')}`;

      if (!dedupe.has(key)) {
        dedupe.add(key);
        attempts.push({ description, params });
      }
    };

    pushAttempt('flight_icao', { flight_icao: callsign });

    const parts = this.extractCallsignParts(callsign);

    if (parts) {
      pushAttempt('airline_icao+flight_number', {
        airline_icao: parts.airlineIcao,
        flight_number: parts.number + parts.suffix,
      });

      if (parts.suffix) {
        pushAttempt('airline_icao+flight_number_without_suffix', {
          airline_icao: parts.airlineIcao,
          flight_number: parts.number,
        });
      }

      if (parts.number !== parts.numberTrimmed) {
        pushAttempt('airline_icao+trimmed_flight_number', {
          airline_icao: parts.airlineIcao,
          flight_number: parts.numberTrimmed + parts.suffix,
        });
      }

      const airlineIata = this.mapAirlineIcaoToIata(parts.airlineIcao);
      if (airlineIata) {
        pushAttempt('airline_iata+flight_number', {
          airline_iata: airlineIata,
          flight_number: parts.number + parts.suffix,
        });

        if (parts.suffix) {
          pushAttempt('airline_iata+flight_number_without_suffix', {
            airline_iata: airlineIata,
            flight_number: parts.number,
          });
        }

        if (parts.number !== parts.numberTrimmed) {
          pushAttempt('airline_iata+trimmed_flight_number', {
            airline_iata: airlineIata,
            flight_number: parts.numberTrimmed + parts.suffix,
          });
        }

        pushAttempt('flight_iata', {
          flight_iata: `${airlineIata}${parts.number}${parts.suffix}`,
        });

        if (parts.number !== parts.numberTrimmed) {
          pushAttempt('flight_iata_trimmed', {
            flight_iata: `${airlineIata}${parts.numberTrimmed}${parts.suffix}`,
          });
        }
      }
    }

    return attempts;
  }

  private extractCallsignParts(callsign: string): CallsignParts | null {
    const prefixMatch = callsign.match(/^[A-Z]+/);
    if (!prefixMatch) {
      return null;
    }

    const prefix = prefixMatch[0];
    const remainder = callsign.slice(prefix.length);
    if (!remainder) {
      return null;
    }

    const numberMatch = remainder.match(/^\d+/);
    if (!numberMatch) {
      return null;
    }

    const number = numberMatch[0];
    const suffix = remainder.slice(number.length);
    const numberTrimmed = number.replace(/^0+/, '') || number;

    return {
      airlineIcao: prefix,
      number,
      numberTrimmed,
      suffix,
    };
  }

  private parseResponse(response: AviationStackResponse, callsign: string): FlightRouteInfo | null {
    if (response.error) {
      logger.error(
        'E-AVI-001',
        `AviationStack responded with error for ${callsign}: ${response.error.message || 'Unknown error'}`,
        response.error
      );
      return null;
    }

    const flight =
      response.data?.find((item) => {
        const flightIcao = item?.flight?.icao || item?.flight?.codeshared?.flight_icao;
        return flightIcao?.toUpperCase() === callsign;
      }) ?? response.data?.[0];

    if (!flight) {
      return null;
    }

    return {
      callsign,
      status: flight.flight_status ?? undefined,
      flightNumber: flight.flight?.number ?? flight.flight?.codeshared?.flight_number ?? undefined,
      airline: flight.airline?.name ?? flight.flight?.codeshared?.airline_name ?? undefined,
      origin: flight.departure
        ? {
            airport: flight.departure.airport ?? undefined,
            iata: flight.departure.iata ?? undefined,
            icao: flight.departure.icao ?? undefined,
            scheduled: flight.departure.scheduled ?? undefined,
            actual: flight.departure.actual ?? undefined,
            estimated: flight.departure.estimated ?? undefined,
            gate: flight.departure.gate ?? undefined,
            terminal: flight.departure.terminal ?? undefined,
            delayMinutes: flight.departure.delay ?? undefined,
          }
        : null,
      destination: flight.arrival
        ? {
            airport: flight.arrival.airport ?? undefined,
            iata: flight.arrival.iata ?? undefined,
            icao: flight.arrival.icao ?? undefined,
            scheduled: flight.arrival.scheduled ?? undefined,
            actual: flight.arrival.actual ?? undefined,
            estimated: flight.arrival.estimated ?? undefined,
            gate: flight.arrival.gate ?? undefined,
            terminal: flight.arrival.terminal ?? undefined,
            baggage: flight.arrival.baggage ?? undefined,
            delayMinutes: flight.arrival.delay ?? undefined,
          }
        : null,
      updatedAt: Date.now(),
    };
  }

  private mapAirlineIcaoToIata(icao: string): string | undefined {
    const mapping: Record<string, string> = {
      AAL: 'AA',
      AEE: 'A3',
      AFR: 'AF',
      AIC: 'AI',
      ANZ: 'NZ',
      ASA: 'AS',
      AUA: 'OS',
      AZA: 'AZ',
      BAW: 'BA',
      BER: 'AB',
      CFG: 'DE',
      CCA: 'CA',
      CPA: 'CX',
      DAL: 'DL',
      DLH: 'LH',
      EIN: 'EI',
      ETD: 'EY',
      EVA: 'BR',
      EZY: 'U2',
      FIN: 'AY',
      GLO: 'G3',
      GWI: '4U',
      HAL: 'HA',
      IBE: 'IB',
      JAL: 'JL',
      KAL: 'KE',
      KLM: 'KL',
      KZR: 'KC',
      LOT: 'LO',
      NAX: 'DY',
      QFA: 'QF',
      QTR: 'QR',
      RYR: 'FR',
      SAS: 'SK',
      SIA: 'SQ',
      SWA: 'WN',
      SWR: 'LX',
      TAP: 'TP',
      THA: 'TG',
      UAE: 'EK',
      UAL: 'UA',
      VIR: 'VS',
      VLG: 'VY',
      WZZ: 'W6',
    };

    return mapping[icao] || undefined;
  }
}
