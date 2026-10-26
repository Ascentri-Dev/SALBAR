import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('Web Dashboard Smoke Test', () => {
  it('renders get started heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Get started/i)
  })

  it('increments counter on button click', () => {
    render(<App />)
    const button = screen.getByRole('button', { name: /Count is 0/i })
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: /Count is 1/i })).toBeInTheDocument()
  })
})
