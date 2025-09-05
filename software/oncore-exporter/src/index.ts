import { hostname } from 'node:os'

import type { ChannelData } from './lib/oncore/exports'

import { OncoreStreamingParser } from './lib/oncore'
import { MetricsExporter } from './lib/prometheus/exporter'
import { MetricsFrame } from './lib/prometheus/frame'

const FRAME_TTL_MS = 10_000 // 10 seconds

const oncore = new OncoreStreamingParser('example.bin')
const metrics = new MetricsExporter({
  globalLabels: {
    host: hostname(),
  }
})

const ha = new MetricsFrame('ha')
const hn = new MetricsFrame('hn')

metrics.addFrame(ha)
metrics.addFrame(hn)

oncore.events.on('Hn', message => {
  hn.reset()

  hn.add('oncore_status_traim', {}, message.traimStatus)
  hn.add('oncore_status_traim_solution', {}, message.traimSolution)
  hn.add('oncore_timing_accuracy_1sigma', {}, message.nsOneSigmaAccuracy / 1_000_000_000) // ns to seconds
  hn.add('oncore_timing_sawtooth_error', {}, message.nsNegativeSawtoothError / 1_000_000_000) // ns to seconds
  hn.add('oncore_status_pulse', {}, message.pulseStatus ? 1 : 0)

  for (const svid of message.ignoredSVIDs) {
    hn.add('oncore_timing_ignored_svids', { svid: svid.toString() }, 1)
  }

  hn.setExpiration(FRAME_TTL_MS)
})

oncore.events.on('Ha', message => {
  ha.reset()

  ha.add('oncore_position_latitude', { solution: 'processed' }, message.position.processed.latitude)
  ha.add('oncore_position_longitude', { solution: 'processed' }, message.position.processed.longitude)
  ha.add('oncore_position_altitude', { solution: 'processed', type: 'gps' }, message.position.processed.altitude.gps)

  ha.add('oncore_position_latitude', { solution: 'unfiltered' }, message.position.unfiltered.latitude)
  ha.add('oncore_position_longitude', { solution: 'unfiltered' }, message.position.unfiltered.longitude)
  ha.add('oncore_position_altitude', { solution: 'unfiltered', type: 'gps' }, message.position.unfiltered.altitude.gps)

  ha.add('oncore_course_speed', { direction: 'vertical' }, message.speed.vertical)
  ha.add('oncore_course_speed', { direction: 'horizontal' }, message.speed.horizontal)
  ha.add('oncore_course_heading', {}, message.speed.horizontalHeading)

  ha.add('oncore_fix_dop', {}, message.dop)
  ha.add('oncore_satellites_count', { type: 'visible' }, message.satellites.visible)
  ha.add('oncore_satellites_count', { type: 'tracking' }, message.satellites.tracking)

  ha.add('oncore_status_fix', {}, message.receiverStatus.fix)
  ha.add('oncore_status_antenna', {}, message.receiverStatus.antennaSense)
  ha.add('oncore_status_insufficient_sats', {}, message.receiverStatus.hasInsufficientVisibleSatellites ? 1 : 0)
  ha.add('oncore_status_autosurvey', {}, message.receiverStatus.isInAutosurveyMode ? 1 : 0)
  ha.add('oncore_status_position_lock', {}, message.receiverStatus.hasPositionLock ? 1 : 0)
  ha.add('oncore_status_differential_fix', {}, message.receiverStatus.hasDifferentialFix ? 1 : 0)
  ha.add('oncore_status_cold_start', {}, message.receiverStatus.hasColdStart ? 1 : 0)
  ha.add('oncore_status_reset_to_raw', {}, message.receiverStatus.hasFilterResetToRawGPS ? 1 : 0)
  ha.add('oncore_status_fast_acquisition', {}, message.receiverStatus.hasFastAcquisitionPosition ? 1 : 0)
  ha.add('oncore_status_narrowband_tracking', {}, message.receiverStatus.isInNarrowBandTrackingMode ? 1 : 0)

  for (let index = 0; index < message.channels.length; index += 1) {
    const data = message.channels[index] as ChannelData
    const channel = index.toString()

    // Skip channels without signal
    if (data.strength === 0) {
      continue
    }

    ha.add('oncore_channel_svid', { channel }, data.svid)
    ha.add('oncore_channel_mode', { channel }, data.mode)
    ha.add('oncore_channel_strength', { channel }, data.strength)
    ha.add('oncore_channel_iode', { channel }, data.iode)

    ha.add('oncore_channel_sv_accuracy', { channel }, data.status.accuracy)
    ha.add('oncore_channel_status_narrowband_search', { channel }, data.status.narrowBandSearchMode ? 1 : 0)
    ha.add('oncore_channel_status_used_for_timing', { channel }, data.status.isUsedForTimingSolution ? 1 : 0)
    ha.add('oncore_channel_status_differential_corrections', { channel }, data.status.isDifferentialCorrectionsAvailable ? 1 : 0)
    ha.add('oncore_channel_status_invalid', { channel }, data.status.isInvalid ? 1 : 0)
    ha.add('oncore_channel_status_parity_error', { channel }, data.status.hasParityError ? 1 : 0)
    ha.add('oncore_channel_status_used_for_position', { channel }, data.status.isUsedForPositionFix ? 1 : 0)
    ha.add('oncore_channel_status_momentum_alert', { channel }, data.status.hasMomentumAlertFlag ? 1 : 0)
    ha.add('oncore_channel_status_antispoof', { channel }, data.status.hasAntispoofFlag ? 1 : 0)
    ha.add('oncore_channel_status_reported_unhealthy', { channel }, data.status.isReportedUnhealthy ? 1 : 0)
  }

  ha.setExpiration(FRAME_TTL_MS)
})

metrics.listen(
  process.env.PORT
    ? Number.parseInt(process.env.PORT, 10)
    : 9100,
  process.env.HOST
)

process.on('SIGINT', async () => {
  await oncore.destroy()
  await metrics.destroy()
  process.exit(0)
})
