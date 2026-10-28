import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { IncidentArchiveScreen } from './IncidentArchiveScreen'
import { ThemeProvider } from '../../context'

function renderScreen(props = {}) {
  return render(
    <ThemeProvider>
      <IncidentArchiveScreen {...props} />
    </ThemeProvider>
  )
}

describe('Incident Archive and Audit History Screen', () => {
  it('renders screen header, summary KPI cards with N/A, and table container', () => {
    renderScreen()

    expect(screen.getByTestId('screen-incident-archive')).toBeInTheDocument()
    expect(screen.getByText('Incident Archive & Audit History')).toBeInTheDocument()
    expect(screen.getByTestId('archive-table-container')).toBeInTheDocument()

    // Top KPIs show N/A
    expect(screen.getByText('Archived Reports')).toBeInTheDocument()
    expect(screen.getByText('Resolution Rate')).toBeInTheDocument()

    // Table rows show N/A
    expect(screen.getByText('INC-N/A-01')).toBeInTheDocument()
    expect(screen.getByText('INC-N/A-02')).toBeInTheDocument()
    expect(screen.getByText('INC-N/A-03')).toBeInTheDocument()
  })

  it('filters table rows by search query', () => {
    renderScreen()

    const searchInput = screen.getByPlaceholderText(/search id, category, location\.\.\./i)
    fireEvent.change(searchInput, { target: { value: 'INC-N/A-01' } })

    expect(screen.getByText('INC-N/A-01')).toBeInTheDocument()
    expect(screen.queryByText('INC-N/A-02')).not.toBeInTheDocument()
    expect(screen.queryByText('INC-N/A-03')).not.toBeInTheDocument()
  })

  it('triggers Export CSV and Export PDF notifications', () => {
    renderScreen()

    const exportCsvBtn = screen.getByRole('button', { name: /export csv/i })
    fireEvent.click(exportCsvBtn)
    expect(screen.getByText(/CSV Export: Generated template archive export/i)).toBeInTheDocument()

    const exportPdfBtn = screen.getByRole('button', { name: /export pdf/i })
    fireEvent.click(exportPdfBtn)
    expect(screen.getByText(/PDF Export: Formatted RDANA report template/i)).toBeInTheDocument()
  })

  it('opens and closes the Audit Trail modal', () => {
    renderScreen()

    const auditButtons = screen.getAllByRole('button', { name: /audit trail/i })
    fireEvent.click(auditButtons[0])

    expect(screen.getByTestId('audit-trail-modal')).toBeInTheDocument()
    expect(screen.getByText(/Incident Audit Log: INC-N\/A-01/i)).toBeInTheDocument()
    expect(screen.getByText('Disaster Operations Lifecycle (RDANA Standard)')).toBeInTheDocument()

    // Close the modal
    const closeButtons = screen.getAllByRole('button', { name: /close audit log/i })
    fireEvent.click(closeButtons[0])

    expect(screen.queryByTestId('audit-trail-modal')).not.toBeInTheDocument()
  })
})
