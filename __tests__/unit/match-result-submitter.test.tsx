import type { ReactElement } from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MatchResultSubmitter } from "@/components/match-result-submitter"
import { I18nProvider } from "@/components/i18n-provider"

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>)
}

describe("MatchResultSubmitter (player device result submission UI)", () => {
  const defaultProps = {
    matchId: "m1",
    player1Name: "Alice",
    player2Name: "Bob",
    isPlayer1: true,
    onSubmit: () => {},
    onConfirm: () => {},
    onCancel: () => {},
  }

  it("shows conflict alert when both confirmed and different results", () => {
    renderWithI18n(
      <MatchResultSubmitter
        {...defaultProps}
        mySubmission={{ result: "player1-win", confirmed: true, timestamp: 1 }}
        opponentSubmission={{ result: "player2-win", confirmed: true, timestamp: 2 }}
      />,
    )
    expect(screen.getByText(/Result Conflict!/i)).toBeInTheDocument()
    expect(screen.getByText(/You submitted/i)).toBeInTheDocument()
    expect(screen.getByText(/Opponent submitted/i)).toBeInTheDocument()
  })

  it("does not show conflict when both agreed", () => {
    renderWithI18n(
      <MatchResultSubmitter
        {...defaultProps}
        mySubmission={{ result: "draw", confirmed: true, timestamp: 1 }}
        opponentSubmission={{ result: "draw", confirmed: true, timestamp: 2 }}
      />,
    )
    expect(screen.queryByText(/Result Conflict!/i)).not.toBeInTheDocument()
  })

  it("shows waiting for opponent when only I confirmed", () => {
    renderWithI18n(
      <MatchResultSubmitter
        {...defaultProps}
        mySubmission={{ result: "player1-win", confirmed: true, timestamp: 1 }}
      />,
    )
    expect(screen.getByText(/Waiting for opponent/i)).toBeInTheDocument()
  })

  it("shows opponent has submitted when they confirmed and I have not", () => {
    renderWithI18n(
      <MatchResultSubmitter
        {...defaultProps}
        opponentSubmission={{ result: "draw", confirmed: true, timestamp: 1 }}
      />,
    )
    expect(screen.getByText(/Your opponent has submitted a result/i)).toBeInTheDocument()
  })
})
