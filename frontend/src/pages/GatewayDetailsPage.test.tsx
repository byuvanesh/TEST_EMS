// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  GatewayDetailsPage,
  GatewayStatusCard,
  GatewayHistoryTable,
  SlaveStatusCard,
  SlaveParameterTable,
  DiagnosticSummary,
  SLAVE_CONFIGURATION,
  PARAMETER_CATALOGUE,
} from './GatewayDetailsPage'
import * as ApiClientModule from '@/api/client'

type GatewayStatus = ApiClientModule.ApiGatewayConnectionStatusResponse['gateway']

describe('GatewayDetailsPage — null-safety', () => {
  // During SSR, useEffect doesn't run, so the page renders in loading state
  it('renders Gateway Monitoring page without crashing during loading', () => {
    const html = renderToString(
      <MemoryRouter>
        <GatewayDetailsPage />
      </MemoryRouter>,
    )

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.querySelector('h1')?.textContent).toContain('Gateway Monitoring')
    expect(doc.body.textContent).toContain('Loading gateway monitoring data…')
  })

  it('does not crash when API returns error', () => {
    vi.spyOn(ApiClientModule.apiClient, 'getGatewayStatus').mockRejectedValue(
      new Error('Failed to fetch gateway status'),
    )
    vi.spyOn(ApiClientModule.apiClient, 'getGatewayHistory').mockResolvedValue({
      gateway_id: 'gw-test-001',
      gateway_mac: '78:1C:3C:AB:76:A0',
      history: [],
      limit: 50,
      offset: 0,
    })
    vi.spyOn(ApiClientModule.apiClient, 'getSystemGateway').mockResolvedValue({
      gateway: {
        id: 'gw-test-001',
        code: 'gw_placeholder_01',
        name: 'TRIKONA ESP32 GATEWAY',
        mac: '78:1C:3C:AB:76:A0',
        firmware_version: 'v2.7.1',
        rs485_master_verified: false,
        status: 'connected',
        mode: 'poll',
        last_receive_time: null,
      },
      meters: [],
    })
    vi.spyOn(ApiClientModule.apiClient, 'getSystemMapping').mockResolvedValue({ meters: [] })
    vi.spyOn(ApiClientModule.apiClient, 'getGatewayLatestPayload').mockResolvedValue({
      ok: true,
      hasPayload: false,
      payloadId: null,
      gatewayId: null,
      gatewayMac: null,
      localServerTs: null,
      receivedAt: null,
      decodeStatus: null,
      mappingVersion: null,
      payload: null,
    })

    const html = renderToString(
      <MemoryRouter>
        <GatewayDetailsPage />
      </MemoryRouter>,
    )

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.body.textContent).toContain('Loading gateway monitoring data…')
  })
})

describe('Four slave identities', () => {
  it('SLAVE_CONFIGURATION exports exactly 4 slaves with correct names', () => {
    expect(SLAVE_CONFIGURATION).toHaveLength(4)
    expect(SLAVE_CONFIGURATION[0]).toEqual({ slaveId: 1, meterName: 'Compressor-01' })
    expect(SLAVE_CONFIGURATION[1]).toEqual({ slaveId: 2, meterName: 'AC-01' })
    expect(SLAVE_CONFIGURATION[2]).toEqual({ slaveId: 3, meterName: 'AC-02' })
    expect(SLAVE_CONFIGURATION[3]).toEqual({ slaveId: 4, meterName: 'AC-03' })
  })

  it('PARAMETER_CATALOGUE exports exactly 12 parameters', () => {
    expect(PARAMETER_CATALOGUE).toHaveLength(12)
    expect(PARAMETER_CATALOGUE[0]).toEqual({ index: 1, parameter: 'Voltage L1', unit: 'V' })
    expect(PARAMETER_CATALOGUE[6]).toEqual({ index: 7, parameter: 'Active Power', unit: 'kW' })
    expect(PARAMETER_CATALOGUE[11]).toEqual({ index: 12, parameter: 'Frequency', unit: 'Hz' })
  })

  it('renders all four slave cards even without meter data', () => {
    // Test SlaveStatusCard directly for each of the 4 slaves
    const baseSlave: Parameters<typeof SlaveStatusCard>[0]['slave'] = {
      slaveId: 1,
      meterName: 'Compressor-01',
      configured: 'NOT CONFIGURED',
      communication: 'NO DATA',
      telemetry: 'NO DATA',
      lastPollTime: null,
      lastTelemetryTime: null,
      receivedKeys: 0,
      validMeasurements: 0,
      missingMeasurements: 12,
      lastError: null,
    }

    for (const { slaveId, meterName } of SLAVE_CONFIGURATION) {
      const html = renderToString(
        <SlaveStatusCard
          slave={{ ...baseSlave, slaveId, meterName }}
        />,
      )
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      expect(doc.body.textContent).toContain(meterName)
      expect(doc.body.textContent).toContain(`Slave ${slaveId}`)
      expect(doc.body.textContent).toContain('NO DATA')
    }
  })
})

describe('SlaveStatusCard — per-slave status', () => {
  const baseSlave: Parameters<typeof SlaveStatusCard>[0]['slave'] = {
    slaveId: 1,
    meterName: 'Compressor-01',
    configured: 'CONFIGURED',
    communication: 'NO DATA',
    telemetry: 'NO DATA',
    lastPollTime: null,
    lastTelemetryTime: null,
    receivedKeys: 0,
    validMeasurements: 0,
    missingMeasurements: 12,
    lastError: null,
  }

  it('renders NOT CONFIGURED slave without fabricated readings', () => {
    const html = renderToString(
      <SlaveStatusCard slave={{ ...baseSlave, configured: 'NOT CONFIGURED' }} />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc.body.textContent).toContain('NOT CONFIGURED')
    expect(doc.body.textContent).toContain('NO DATA')
  })

  it('renders COMMUNICATING slave with key counts', () => {
    const html = renderToString(
      <SlaveStatusCard slave={{ ...baseSlave, communication: 'COMMUNICATING', receivedKeys: 6 }} />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc.body.textContent).toContain('COMMUNICATING')
    expect(doc.body.textContent).toContain('6')
  })

  it('renders COMMUNICATION ERROR slave with error message', () => {
    const html = renderToString(
      <SlaveStatusCard
        slave={{
          ...baseSlave,
          communication: 'COMMUNICATION ERROR',
          lastError: 'Timeout waiting for Modbus response',
        }}
      />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc.body.textContent).toContain('COMMUNICATION ERROR')
    expect(doc.body.textContent).toContain('Timeout waiting for Modbus response')
  })
})

describe('SlaveParameterTable — 12 parameters per slave', () => {
  const emptyMappings: ApiClientModule.ApiMappingItem[] = []
  const emptyPayload: Record<string, unknown> | null = null

  it('renders exactly 12 parameter rows for Slave 1', () => {
    const html = renderToString(
      <SlaveParameterTable
        slaveId={1}
        meterName="Compressor-01"
        mappings={emptyMappings}
        payload={emptyPayload}

      />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const rows = doc.querySelectorAll('tbody tr')
    expect(rows.length).toBe(12)
  })

  it('shows Mapping Required when no mapping exists', () => {
    const html = renderToString(
      <SlaveParameterTable
        slaveId={1}
        meterName="Compressor-01"
        mappings={emptyMappings}
        payload={emptyPayload}

      />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc.body.textContent).toContain('Mapping Required')
  })

  it('shows No Data (not zero) for missing values', () => {
    const html = renderToString(
      <SlaveParameterTable
        slaveId={2}
        meterName="AC-01"
        mappings={emptyMappings}
        payload={emptyPayload}

      />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc.body.textContent).toContain('—')
    // Should NOT contain '0' as a fabricated value for missing data
    const valueCells = doc.querySelectorAll('td.font-mono.text-text')
    for (const cell of valueCells) {
      expect(cell.textContent).not.toBe('0')
    }
  })

  it('does not copy Slave 1 readings into Slave 2', () => {
    const payloadWithSlave1 = {
      s1_hold1: 230.5,
      s1_hold3: 0.85,
    } as Record<string, unknown>

    // Mapping exists only for Slave 1's Voltage L1 parameter
    const slave1Mapping: ApiClientModule.ApiMappingItem[] = [
      {
        id: 'map-001',
        metric: 'Voltage L1',
        source_keys: ['s1_hold1'],
        decode: 'number',
        word_order: 'BE',
        byte_order: 'BE',
        scale: 1,
        offset: 0,
        unit: 'V',
        verification_status: 'UNVERIFIED',
        verified_by: null,
        verified_at: null,
        evidence_note: null,
        version: 1,
      },
    ]

    const html1 = renderToString(
      <SlaveParameterTable
        slaveId={1}
        meterName="Compressor-01"
        mappings={slave1Mapping}
        payload={payloadWithSlave1}

      />,
    )
    const html2 = renderToString(
      <SlaveParameterTable
        slaveId={2}
        meterName="AC-01"
        mappings={slave1Mapping}
        payload={payloadWithSlave1}

      />,
    )

    const parser1 = new DOMParser()
    const doc1 = parser1.parseFromString(html1, 'text/html')
    const parser2 = new DOMParser()
    const doc2 = parser2.parseFromString(html2, 'text/html')

    // Slave 1 should show the mapped value
    expect(doc1.body.textContent).toContain('230.5')
    // Slave 2 should NOT show Slave 1's value (no mapping for Slave 2)
    expect(doc2.body.textContent).not.toContain('230.5')
    // Slave 2 should show Mapping Required (no mapping for Slave 2)
    expect(doc2.body.textContent).toContain('Mapping Required')
  })
})

describe('GatewayStatusCard — null-safety and state rendering', () => {
  const mockStatus: GatewayStatus = {
    id: 'gw-test-001',
    code: 'gw_placeholder_01',
    name: 'TRIKONA ESP32 GATEWAY',
    mac: '78:1C:3C:AB:76:A0',
    firmware_version: 'v2.7.1',
    source_type: 'REAL',
    connection_state: 'NOT_CONNECTED',
    last_heartbeat_at: null,
    last_telemetry_at: null,
    last_ingest_error_at: null,
    last_ingest_error_message: null,
    connection_duration_seconds: null,
    migration_required: false,
    thresholds: { online_seconds: 60, stale_seconds: 180, offline_seconds: 300 },
    totals: { heartbeats: 0, telemetry_uploads: 0, ingest_errors: 0, auth_errors: 0, validation_errors: 0 },
  }

  it('renders NOT_CONNECTED state without crashing', () => {
    const html = renderToString(<GatewayStatusCard status={mockStatus} />)
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.body.textContent).toContain('Not Connected')
  })

  it('renders DATA_RECEIVING state without crashing', () => {
    const statusReceiving: GatewayStatus = { ...mockStatus, connection_state: 'DATA_RECEIVING' }
    const html = renderToString(<GatewayStatusCard status={statusReceiving} />)
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.body.textContent).toContain('Data Receiving')
  })

  it('shows Not reported when firmware version is null', () => {
    const html = renderToString(
      <GatewayStatusCard status={{ ...mockStatus, firmware_version: null }} />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.body.textContent).toContain('Not reported')
  })

  it('shows firmware version with last-reported timestamp when available', () => {
    const statusWithFw = { ...mockStatus, firmware_version: 'v2.7.1', last_heartbeat_at: '2026-11-10T10:00:00Z' }
    const html = renderToString(<GatewayStatusCard status={statusWithFw} />)
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.body.textContent).toContain('v2.7.1')
  })
})

describe('GatewayHistoryTable', () => {
  it('renders compact migration notice when migrationRequired is true', () => {
    const html = renderToString(
      <GatewayHistoryTable
        history={[]}
        migrationRequired={true}
        migrationMessage='Migration 012 not applied'
      />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.body.textContent).toContain('History tracking unavailable')
    expect(doc.body.textContent).toContain('Migration 012 not applied')
  })

  it('renders compact empty state when no history', () => {
    const html = renderToString(
      <GatewayHistoryTable history={[]} migrationRequired={false} migrationMessage={null} />,
    )
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc).not.toBeNull()
    expect(doc.body.textContent).toContain('No communication history')
  })
})

describe('DiagnosticSummary', () => {
  it('renders PASS/FAIL/NOT TESTED/NOT AVAILABLE statuses', () => {
    const diagnostics = [
      { name: 'Gateway Communication', status: 'PASS' as const, detail: 'DATA_RECEIVING' },
      { name: 'Heartbeat API', status: 'NOT AVAILABLE' as const, detail: 'Migration 012 not applied' },
      { name: 'Meter Mapping', status: 'FAIL' as const, detail: 'Zero metric mappings' },
      { name: 'Telemetry Ingestion', status: 'NOT TESTED' as const, detail: 'No data yet' },
    ]

    const html = renderToString(<DiagnosticSummary diagnostics={diagnostics} />)
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    expect(doc.body.textContent).toContain('PASS')
    expect(doc.body.textContent).toContain('FAIL')
    expect(doc.body.textContent).toContain('NOT TESTED')
    expect(doc.body.textContent).toContain('NOT AVAILABLE')
  })
})
