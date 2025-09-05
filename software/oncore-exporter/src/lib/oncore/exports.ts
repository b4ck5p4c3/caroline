/* eslint-disable perfectionist/sort-enums -- ordered by OnCore enum values */
export enum ChannelMode {
  CodeSearch = 0,
  CodeAcquire = 1,
  AGCSet = 2,
  FreqAcquire = 3,
  BitSyncDetect = 4,
  MessageSyncDetect = 5,
  SatelliteTimeAvailable = 6,
  EphemerisAcquire = 7,
  AvailableForPosition = 8,
}

export enum ReceiverFixStatus {
  Fix3D = 0b111,
  Fix2D = 0b110,
  PropagateMode = 0b101,
  PositionHold = 0b100,
  AcquiringSatellites = 0b011,
  BadGeometry = 0b010
}

export enum AntennaSense {
  OK = 0b00,
  Overcurrent = 0b01,
  Undercurrent = 0b10,
  NoBiasVoltage = 0b11,
}

export enum CodeLocation {
  External = 0b0,
  Internal = 0b1,
}

export interface ChannelData {
  iode: number;
  mode: ChannelMode;
  status: {
    // SV Accuracy (para 20.3.3.3.1.3 of ICD-GPS-200)
    accuracy: number;
    hasAntispoofFlag: boolean;
    hasMomentumAlertFlag: boolean;
    hasParityError: boolean;
    isDifferentialCorrectionsAvailable: boolean;
    isInvalid: boolean;
    isReportedUnhealthy: boolean;
    isUsedForPositionFix: boolean;
    isUsedForTimingSolution: boolean;

    narrowBandSearchMode: boolean;
  }
  strength: number;
  svid: number;
}

export interface HaMessage {
  // Twelve channels for M12M
  channels: [
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData,
    ChannelData
  ];
  day: number;
  // PDOP if 3D fix, HDOP for 2D fix
  dop: number;
  fractionalNs: number;
  hours: number;
  minutes: number;
  month: number;

  position: {
    processed: {
      altitude: {
        gps: number;
        msl: number;
      }
      latitude: number;
      longitude: number;
    };
    unfiltered: {
      altitude: {
        gps: number;
        msl: number;
      }
      latitude: number;
      longitude: number;
    };
  };

  receiverStatus: {
    antennaSense: AntennaSense;
    codeLocation: CodeLocation;
    fix: ReceiverFixStatus;
    hasColdStart: boolean;
    hasDifferentialFix: boolean;
    hasFastAcquisitionPosition: boolean;
    hasFilterResetToRawGPS: boolean;
    hasInsufficientVisibleSatellites: boolean;
    hasPositionLock: boolean;
    isInAutosurveyMode: boolean;
    isInNarrowBandTrackingMode: boolean;
  }

  satellites: {
    tracking: number;
    visible: number;
  };

  seconds: number;

  speed: {
    horizontal: number;
    horizontalHeading: number;
    vertical: number;
  };

  year: number;
}

export enum PulseSyncSource {
  UTC = 0,
  GPS = 1,
}

export enum TRAIMSolution {
  OK = 0,
  Alarm = 1,
  Unknown = 2,
}

export enum TRAIMStatus {
  IsolationAvailable = 0,
  DetectionOnly = 1,
  NotAvailable = 2,
}

export interface TimingChannelData {
  nsFractionalGPSTime: number;
  svid: number;
}

export interface HnMessage {
  ignoredSVIDs: number[];
  nsNegativeSawtoothError: number;
  nsOneSigmaAccuracy: number;
  pulseStatus: boolean;
  pulseSync: PulseSyncSource;
  timingChannels: [
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData,
    TimingChannelData
  ]
  traimSolution: TRAIMSolution;
  traimStatus: TRAIMStatus;
}

export interface VisibleSatelliteData {
  azimuth: number;
  elevation: number;
  hzDoppler: number;
  isHealthy: boolean;
  svid: number;
}

export interface BbMessage {
  numberOfVisibleSatellites: number;
  satellites: VisibleSatelliteData[];
}

export interface AbstractParseResult {
  payload: unknown;
  type: 'Bb' | 'Ha' | 'Hn';
}

export interface HaParseResult extends AbstractParseResult {
  payload: HaMessage;
  type: 'Ha';
}

export interface HnParseResult extends AbstractParseResult {
  payload: HnMessage;
  type: 'Hn';
}

export interface BbParseResult extends AbstractParseResult {
  payload: BbMessage;
  type: 'Bb';
}

export type ParseResult = BbParseResult | HaParseResult | HnParseResult
