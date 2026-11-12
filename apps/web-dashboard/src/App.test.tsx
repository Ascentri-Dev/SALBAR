import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('Web Dashboard Screen Scaffolding', () => {
  it('renders ambient header and defaults to command map screen', () => {
    render(<App />)
    expect(screen.getByTestId('ambient-status-header')).toBeInTheDocument()
    expect(screen.getByTestId('screen-command-map')).toBeInTheDocument()
    expect(screen.getByTestId('gis-map-container')).toBeInTheDocument()
    expect(screen.getByTestId('incident-stream-panel')).toBeInTheDocument()
  })

  it('navigates to field responder fleet management screen', () => {
    render(<App />)
    const fleetTab = screen.getByTestId('nav-tab-fleet-management')
    fireEvent.click(fleetTab)

    expect(screen.getByTestId('screen-fleet-management')).toBeInTheDocument()
    expect(screen.getByTestId('responder-units-grid')).toBeInTheDocument()
    expect(screen.queryByTestId('screen-command-map')).not.toBeInTheDocument()
  })

  it('navigates to incident archive screen', () => {
    render(<App />)
    const archiveTab = screen.getByTestId('nav-tab-incident-archive')
    fireEvent.click(archiveTab)

    expect(screen.getByTestId('screen-incident-archive')).toBeInTheDocument()
    expect(screen.getByTestId('archive-table-container')).toBeInTheDocument()
    expect(screen.queryByTestId('screen-command-map')).not.toBeInTheDocument()
  })
})
