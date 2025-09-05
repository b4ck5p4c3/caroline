/**
 * Motorola OnCore Binary Protocol Implementation.
 * Protocol implementation for twelve-channel GPS receivers (M12M, M12+, M12M Timing)
 *
 * Based on i-Lotus GPS Products - M12M User's Guide Revision D, May 28, 2008
 */

import {
  AntennaSense,
  type BbMessage,
  type BbParseResult,
  type ChannelData,
  ChannelMode,
  CodeLocation,
  type HaMessage,
  type HaParseResult,
  type HnMessage,
  type HnParseResult,
  type ParseResult,
  PulseSyncSource,
  ReceiverFixStatus,
  type TimingChannelData,
  TRAIMSolution,
  TRAIMStatus,
  type VisibleSatelliteData
} from './exports'

function millisecondsToDegrees (ms: number): number {
  return ms / 3_600_000
}

function parseHaChannel (data: Buffer): ChannelData {
  const statusRegisterA = data.readUint8(4)
  const statusRegisterB = data.readUint8(5)

  return {
    iode: data.readUint8(3),
    mode: data.readUint8(1) as ChannelMode,
    status: {
      accuracy: statusRegisterB & 0b0000_1111,
      hasAntispoofFlag: (statusRegisterB & 0b1000_0000) !== 0,
      hasMomentumAlertFlag: (statusRegisterB & 0b0100_0000) !== 0,
      hasParityError: (statusRegisterB & 0b0001_0000) !== 0,
      isDifferentialCorrectionsAvailable: (statusRegisterA & 0b0100_0000) !== 0,
      isInvalid: (statusRegisterA & 0b1000_0000) !== 0,
      isReportedUnhealthy: (statusRegisterB & 0b0000_0001) !== 0,
      isUsedForPositionFix: (statusRegisterB & 0b0010_0000) !== 0,
      isUsedForTimingSolution: (statusRegisterA & 0b0010_0000) !== 0,
      narrowBandSearchMode: (statusRegisterA & 0b0001_0000) !== 0,
    },
    strength: data.readUint8(2),
    svid: data.readUint8(0)
  }
}

function parseHaMessage (message: Buffer): HaParseResult {
  const receiverStatusRegA = message.readUint8(129)
  const receiverStatusRegB = message.readUint8(130)

  const result: HaMessage = {
    // We have 12 channels receiver, 6 byte each
    channels: [
      parseHaChannel(message.subarray(57, 63)),
      parseHaChannel(message.subarray(63, 69)),
      parseHaChannel(message.subarray(69, 75)),
      parseHaChannel(message.subarray(75, 81)),
      parseHaChannel(message.subarray(81, 87)),
      parseHaChannel(message.subarray(87, 93)),
      parseHaChannel(message.subarray(93, 99)),
      parseHaChannel(message.subarray(99, 105)),
      parseHaChannel(message.subarray(105, 111)),
      parseHaChannel(message.subarray(111, 117)),
      parseHaChannel(message.subarray(117, 123)),
      parseHaChannel(message.subarray(123, 129))
    ] as [
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
    ],
    day: message.readUint8(5),
    // PDOP if 3D fix, HDOP for 2D fix
    dop: message.readUint16BE(53) / 100,

    fractionalNs: message.readUint32BE(11),
    hours: message.readUint8(8),
    minutes: message.readUint8(9),
    month: message.readUint8(4),

    position: {
      processed: {
        altitude: {
          gps: message.readUint32BE(23) / 100, // cm to meters
          msl: message.readUint32BE(27) / 100, // cm to meters
        },
        latitude: millisecondsToDegrees(message.readUint32BE(15)),
        longitude: millisecondsToDegrees(message.readUint32BE(19))
      },
      unfiltered: {
        altitude: {
          gps: message.readUint32BE(39) / 100, // cm to meters
          msl: message.readUint32BE(43) / 100, // cm to meters
        },
        latitude: millisecondsToDegrees(message.readUint32BE(31)),
        longitude: millisecondsToDegrees(message.readUint32BE(35))
      }
    },

    receiverStatus: {
      antennaSense: (0b1110_0000 & 0b0110_0000) >> 5 as AntennaSense,
      codeLocation: (receiverStatusRegA & 0b1000_0000) === 0
        ? CodeLocation.Internal
        : CodeLocation.External,
      fix: (receiverStatusRegB & 0b0000_0111) as ReceiverFixStatus,
      hasColdStart: (receiverStatusRegA & 0b0000_0001) !== 0,
      hasDifferentialFix: (receiverStatusRegA & 0b0000_0010) !== 0,
      hasFastAcquisitionPosition: (receiverStatusRegB & 0b0100_0000) !== 0,
      hasFilterResetToRawGPS: (receiverStatusRegB & 0b1000_0000) !== 0,

      hasInsufficientVisibleSatellites: (receiverStatusRegA & 0b0001_0000) !== 0,
      hasPositionLock: (receiverStatusRegA & 0b0000_0100) !== 0,
      isInAutosurveyMode: (receiverStatusRegA & 0b0000_1000) !== 0,
      isInNarrowBandTrackingMode: (receiverStatusRegB & 0b0010_0000) !== 0
    },

    satellites: {
      tracking: message.readUint8(56),
      visible: message.readUint8(55)
    },

    seconds: message.readUint8(10),

    speed: {
      horizontal: message.readUint16BE(49) / 100, // cm/s to m/s
      horizontalHeading: message.readUint16BE(51) / 100, // tens of degrees to degrees
      vertical: message.readUint16BE(47) / 100 // cm/s to m/s
    },

    year: message.readUint16BE(6)
  }

  return {
    payload: result,
    type: 'Ha'
  }
};

function extractTruthBitsPosition (index32: number): number[] {
  const bits: number[] = []
  for (let index = 0; index < 32; index++) {
    const value = (index32 >> index) & 1
    if (value) {
      bits.push(index)
    }
  }
  return bits
}

function parseTimingChannelData (message: Buffer): TimingChannelData {
  return {
    nsFractionalGPSTime: message.readUint32BE(1),
    svid: message.readUint8(0)
  }
}

function parseHnMessage (message: Buffer): HnParseResult {
  const payload: HnMessage = {
    ignoredSVIDs: extractTruthBitsPosition(
      message.readUint32BE(8)
    ),
    nsNegativeSawtoothError: message.readUint8(14),
    nsOneSigmaAccuracy: message.readUint16BE(12),
    pulseStatus: message.readUint8(4) !== 0,
    pulseSync: message.readUint8(5) === 0
      ? PulseSyncSource.UTC
      : PulseSyncSource.GPS,
    timingChannels: [
      parseTimingChannelData(message.subarray(15, 20)),
      parseTimingChannelData(message.subarray(20, 25)),
      parseTimingChannelData(message.subarray(25, 30)),
      parseTimingChannelData(message.subarray(30, 35)),
      parseTimingChannelData(message.subarray(35, 40)),
      parseTimingChannelData(message.subarray(40, 45)),
      parseTimingChannelData(message.subarray(45, 50)),
      parseTimingChannelData(message.subarray(50, 55)),
      parseTimingChannelData(message.subarray(55, 60)),
      parseTimingChannelData(message.subarray(60, 65)),
      parseTimingChannelData(message.subarray(65, 70)),
      parseTimingChannelData(message.subarray(70, 75))
    ],
    traimSolution: message.readUint8(6) as TRAIMSolution,
    traimStatus: message.readUint8(7) as TRAIMStatus
  }

  return {
    payload,
    type: 'Hn',
  }
}

function parseVisibleSatellite (message: Buffer): VisibleSatelliteData {
  return {
    azimuth: message.readUint16BE(4),
    elevation: message.readUint8(3),
    hzDoppler: message.readUint16BE(1),
    isHealthy: message.readUint8(6) === 0,
    svid: message.readUint8(0)
  }
}

function parseBbMessage (message: Buffer): BbParseResult {
  const numberOfVisibleSatellites = message.readUint8(4)
  const satellites: VisibleSatelliteData[] = []

  for (let index = 0; index < numberOfVisibleSatellites; index += 1) {
    satellites.push(parseVisibleSatellite(message.subarray(5 + (index * 7), 12 + (index * 7))))
  }

  const payload: BbMessage = {
    numberOfVisibleSatellites,
    satellites
  }

  return {
    payload,
    type: 'Bb'
  }
}

export function parseOncoreMessage (message: Buffer): null | ParseResult {
  if (message.length < 4) {
    throw new Error('Message too short')
  }

  const messageType = message.subarray(0, 4).toString('ascii')
  switch (messageType) {
    case '@@Bb': {
      if (message.length !== 92) {
        return null
      }
      return parseBbMessage(message)
    }

    case '@@Ha': {
      if (message.length !== 154) {
        return null
      }
      return parseHaMessage(message)
    }

    case '@@Hn': {
      if (message.length !== 78) {
        return null
      }
      return parseHnMessage(message)
    }

    default: {
      return null
    }
  }
}
