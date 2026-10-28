import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FleetManagementScreen } from './FleetManagementScreen'
import { ThemeProvider } from '../../context'

function renderScreen(props = {}) {
  return render(
    <ThemeProvider>
      <FleetManagementScreen {...props} />
    </ThemeProvider>
  )
}

describe('Field Responder Fleet Management Screen', () => {
  it('renders header, fleet summary KPIs with N/A, and all 3 unit cards', () => {
    renderScreen()

    expect(screen.getByTestId('screen-fleet-management')).toBeInTheDocument()
    expect(screen.getByText('Field Responder Fleet Management')).toBeInTheDocument()
    expect(screen.getByText('Deployed Terminals')).toBeInTheDocument()
    expect(screen.getByTestId('responder-units-grid')).toBeInTheDocument()

    expect(screen.getByTestId('unit-card-sar-01')).toBeInTheDocument()
    expect(screen.getByTestId('unit-card-da-02')).toBeInTheDocument()
    expect(screen.getByTestId('unit-card-relief-03')).toBeInTheDocument()

    // Battery, GPS, and other telemetry display N/A
    const sarCard = screen.getByTestId('unit-card-sar-01')
    expect(sarCard).toHaveTextContent('N/A')
  })

  it('filters units by search query', () => {
    renderScreen()

    const searchInput = screen.getByPlaceholderText(/search call-sign, unit id, role\.\.\./i)
    fireEvent.change(searchInput, { target: { value: 'SAR' } })

    expect(screen.getByTestId('unit-card-sar-01')).toBeInTheDocument()
    expect(screen.queryByTestId('unit-card-da-02')).not.toBeInTheDocument()
    expect(screen.queryByTestId('unit-card-relief-03')).not.toBeInTheDocument()
  })

  it('toggles mandatory rest on a responder unit and updates status filter', () => {
    renderScreen()

    const sarCard = screen.getByTestId('unit-card-sar-01')
    expect(sarCard).toHaveTextContent('N/A')

    // Find the Force Rest button inside the SAR card
    const restButtons = screen.getAllByRole('button', { name: /force rest/i })
    fireEvent.click(restButtons[0])

    // Should now show RESTING and button should change to Resume Duty
    expect(sarCard).toHaveTextContent('RESTING')

    // Click RESTING filter
    const restingFilterBtn = screen.getByRole('button', { name: /RESTING/i })
    fireEvent.click(restingFilterBtn)

    expect(screen.getByTestId('unit-card-sar-01')).toBeInTheDocument()
    expect(screen.queryByTestId('unit-card-da-02')).not.toBeInTheDocument()
    expect(screen.queryByTestId('unit-card-relief-03')).not.toBeInTheDocument()
  })

  it('opens and closes the detailed telemetry inspector modal with N/A fields', () => {
    renderScreen()

    const telemetryButtons = screen.getAllByRole('button', { name: /telemetry/i })
    fireEvent.click(telemetryButtons[0])

    expect(screen.getByTestId('unit-inspector-modal')).toBeInTheDocument()
    expect(screen.getByText('Responder Fatigue Calibration')).toBeInTheDocument()
    expect(screen.getByText(/power & battery/i)).toBeInTheDocument()
    expect(screen.getByText(/gps & positioning/i)).toBeInTheDocument()

    // Close the modal
    const closeButtons = screen.getAllByRole('button', { name: /close inspector/i })
    fireEvent.click(closeButtons[0])

    expect(screen.queryByTestId('unit-inspector-modal')).not.toBeInTheDocument()
  })

  it('calls onSelectScreen when Locate on Map is clicked', () => {
    const handleSelect = vi.fn()
    renderScreen({ onSelectScreen: handleSelect })

    const locateButtons = screen.getAllByRole('button', { name: /locate .* on map/i })
    fireEvent.click(locateButtons[0])

    expect(handleSelect).toHaveBeenCalledWith('command-map')
  })
})
