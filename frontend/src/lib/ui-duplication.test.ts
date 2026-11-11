/**
 * Frontend UI duplication and no-data status regression tests.
 *
 * These tests verify:
 * 1. No duplicate StatusBadge rendering for the same data state on a single page.
 * 2. No misleading "healthy" / "all parameters normal" messaging when telemetry is NO_DATA.
 * 3. Firmware version comes from API response (not hardcoded source-code version).
 * 4. "Verified Variant" badge distinguishes config verification from live communication.
 * 5. No nested empty-state containers (single EmptyState per card).
 */

import { describe, expect, it } from 'vitest'
import overviewPageSource from '@/pages/OverviewPage.tsx?raw'
import energyPageSource from '@/pages/EnergyPage.tsx?raw'
import alarmsPageSource from '@/pages/AlarmsPage.tsx?raw'
import systemPageSource from '@/pages/SystemPage.tsx?raw'
import gatewayPageSource from '@/pages/GatewayDetailsPage.tsx?raw'

function countOccurrences(source: string, pattern: string): number {
  return (source.match(new RegExp(pattern, 'g')) || []).length
}describe('UI duplication regression guards', () => {
  describe('Overview page — no duplicate status badges', () => {
    it('PageHeader contains a StatusBadge (page-level state indicator)', () => {
      const pageHeaderIdx = overviewPageSource.indexOf('<PageHeader')
      const statusBadgeIdx = overviewPageSource.indexOf('<StatusBadge')
      // StatusBadge must appear after PageHeader starts
      expect(statusBadgeIdx).toBeGreaterThan(pageHeaderIdx)
    })

    it('does not render StatusBadge in Loads section header', () => {
      const loadsSection = overviewPageSource.slice(
        overviewPageSource.indexOf('{/* Loads Section */}'),
        overviewPageSource.indexOf('{/* Power Chart + Alarms Section */}'),
      )
      expect(loadsSection).not.toContain('StatusBadge')
    })

    it('does not render StatusBadge in Power Chart card header', () => {
      const chartSection = overviewPageSource.slice(
        overviewPageSource.indexOf('{/* 24-hour Power Chart Card */}'),
        overviewPageSource.indexOf('{/* Open Alarms Card */}'),
      )
      expect(chartSection).not.toContain('StatusBadge')
    })

    it('uses one KPI section with both mobile and desktop in a single grid', () => {
      expect(overviewPageSource).toContain('md:grid-cols-3 lg:grid-cols-5')
      const mobileLayoutCount = countOccurrences(overviewPageSource, 'md:hidden')
      expect(mobileLayoutCount).toBe(0)
    })
  })

  describe('Energy page — no duplicate status badges, no local KpiCard', () => {
    it('does not define a local KpiCard component', () => {
      expect(energyPageSource).not.toContain('function KpiCard(')
    })

    it('imports shared KpiCard from @/components/ui/KpiCard', () => {
      expect(energyPageSource).toContain(
        "import { KpiCard } from '@/components/ui/KpiCard'",
      )
    })

    it('renders exactly one StatusBadge total on the page', () => {
      // PageHeader has 1; filter bar and interval table header badges removed
      expect(countOccurrences(energyPageSource, '<StatusBadge')).toBe(1)
    })

    it('does not render StatusBadge in filter bar', () => {
      const filterBar = energyPageSource.slice(
        energyPageSource.indexOf('{/* Filter Bar */}'),
        energyPageSource.indexOf('{/* Real KPIs'),
      )
      expect(filterBar).not.toContain('StatusBadge')
    })

    it('does not render StatusBadge in interval table card header', () => {
      const tableSection = energyPageSource.slice(
        energyPageSource.indexOf('{/* Real Interval History & GAP Breakdown */}'),
      )
      const cardHeaderSection = tableSection.slice(
        0,
        tableSection.indexOf('</CardHeader>') + '</CardHeader>'.length,
      )
      expect(cardHeaderSection).not.toContain('StatusBadge')
    })
  })

  describe('Alarms page — flattened empty state, no misleading healthy claim', () => {
    it('does not nest EmptyState inside multiple container divs', () => {
      // Old pattern: Card > div.p-6 > div.rounded-[6px]...p-8 > EmptyState
      // New pattern: Card > EmptyState directly
      expect(alarmsPageSource).not.toContain(
        '<div className="p-6">\n          <div className="rounded-[6px] border border-dashed border-border/80 bg-surface/30 p-8">\n            <EmptyState',
      )
      const cardIdx = alarmsPageSource.indexOf('<Card padding="none">')
      const emptyIdx = alarmsPageSource.indexOf('<EmptyState')
      const between = alarmsPageSource.slice(cardIdx, emptyIdx)
      expect(between).not.toMatch(/<div/)
    })

    it('does not claim all parameters normal without telemetry', () => {
      expect(alarmsPageSource).not.toContain(
        'All monitored parameters within nominal operating thresholds',
      )
    })

    it('distinguishes no alarms from evaluation unavailable', () => {
      expect(alarmsPageSource).toContain(
        'Alarm evaluation unavailable — no valid telemetry input',
      )
    })

    it('removes unnecessary Card wrapper around Tabs', () => {
      const tabsSection = alarmsPageSource.slice(
        alarmsPageSource.indexOf('{/* Tabs */}'),
        alarmsPageSource.indexOf('{/* Alarms Content'),
      )
      expect(tabsSection).not.toContain('<Card')
      expect(tabsSection).toContain('<Tabs')
    })
  })

  describe('System page — Verified Variant badge clarity', () => {
    it('renames Verified Variant to Modbus Variant Verified (Config)', () => {
      expect(systemPageSource).toContain(
        'Modbus Variant Verified (Config)',
      )
      expect(systemPageSource).toContain(
        'Modbus Variant Unverified (Config)',
      )
    })

    it('does not use the misleading "Verified Variant" label alone', () => {
      expect(systemPageSource).not.toContain(">Verified Variant<")
      expect(systemPageSource).not.toContain(">Unverified Variant<")
    })
  })

  describe('Firmware version integrity', () => {
    it('Overview page reads firmware from API response, not hardcoded', () => {
      expect(overviewPageSource).toContain(
        "gatewayStatus?.firmware_version ?? '—'",
      )
      expect(overviewPageSource).not.toContain('2.7.1')
      expect(overviewPageSource).not.toContain('1.9.13')
    })

    it('Gateway page reads firmware from API response, not hardcoded', () => {
      expect(gatewayPageSource).toContain('firmware_version')
      expect(gatewayPageSource).toContain('firmwareDisplay')
      // No hardcoded 2.7.1 or 1.9.13 in the page source
      expect(gatewayPageSource).not.toContain("'2.7.1'")
      expect(gatewayPageSource).not.toContain("'1.9.13'")
    })

    it('shows Not reported when firmware version is null', () => {
      expect(gatewayPageSource).toContain('Not reported')
    })

    it('System page reads firmware from API response, not hardcoded', () => {
      expect(systemPageSource).toContain(
        "gw.gateway.firmware_version ?? '—'",
      )
    })
  })
})
