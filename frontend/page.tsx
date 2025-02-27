"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import TruthOrb from "./truth-orb"
import axios from "axios"

const API_URL = "http://localhost:3000/truthseeker/"
axios.defaults.baseURL = API_URL

const verifyTeam = async (claim: string, team: "blue" | "red", prevTeamInformation?: string, prevTeamDecision?: string) => {
  const response = await axios.post("verify-claim-1", {
    claim,
    team,
    prevTeamInformation,
    prevTeamDecision,
  })
  return response.data
}

const verifyAggregate = async (claim: string, blueTeamInformation?: string, blueTeamDecision?: string, redTeamInformation?: string, redTeamDecision?: string) => {
  const response = await axios.post("verify-claim-2", {
    claim,
    blueTeamInformation,
    blueTeamDecision,
    redTeamInformation,
    redTeamDecision,
  })
  return response.data
}

export default function ClaimVerifier() {
  const [claim, setClaim] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<null | {
    verified: boolean
    confidence: number
    explanation: string
  }>(null)

  const handleVerify = async () => {
    if (!claim.trim()) return

    setIsVerifying(true)

    let aggregator: any
    try {
      const blueTeam = await verifyTeam(claim, "blue")
      const redTeam = await verifyTeam(claim, "red", blueTeam.queryResults, blueTeam.decision)
      aggregator = await verifyAggregate(claim, blueTeam.queryResults, blueTeam.decision, redTeam.queryResults, redTeam.decision)
    } catch (e) {
      setIsVerifying(false)
      throw e
    }

    setResult({
      verified: aggregator.decision,
      confidence: aggregator.confidence,
      explanation: aggregator.reason,
    })
    setIsVerifying(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-3xl space-y-12">
          <header className="text-center space-y-4">
            <TruthOrb />
            <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">
              TruthSeeker
            </h1>
            <p className="text-gray-400 text-lg sm:text-xl">Advanced Claim Verification System</p>
          </header>

          <div className="space-y-8">
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-gray-900 rounded-lg p-6 shadow-xl">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="claim" className="text-sm text-gray-400">
                      Enter claim to verify
                    </label>
                    <Input
                      id="claim"
                      value={claim}
                      onChange={(e) => setClaim(e.target.value)}
                      placeholder="e.g., 'The Earth is flat'"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-cyan-500 focus:border-cyan-500"
                    />
                  </div>

                  <Button
                    onClick={handleVerify}
                    disabled={!claim.trim() || isVerifying}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-md transition-all duration-200 shadow-lg shadow-cyan-500/20"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Consulting the Orb
                      </>
                    ) : (
                      "Verify Claim"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {result && (
              <div className="relative">
                <div
                  className={`absolute -inset-0.5 rounded-lg blur opacity-40 ${
                    result.verified ? "bg-green-400" : "bg-red-400"
                  }`}
                ></div>
                <div className="relative bg-gray-900 rounded-lg p-6 shadow-xl">
                  <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold">{result.verified ? "TRUTH CONFIRMED" : "FALSEHOOD DETECTED"}</h3>
                    <div className="mt-2 flex justify-center">
                      <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-800">
                        <div className="mr-2">Confidence:</div>
                        <div className="h-2 w-24 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${result.verified ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${result.confidence}%` }}
                          ></div>
                        </div>
                        <div className="ml-2 font-medium">{result.confidence}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center">
                      {result.verified ? (
                        <CheckCircle className="h-12 w-12 text-green-500" />
                      ) : (
                        <XCircle className="h-12 w-12 text-red-500" />
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-300 text-center">{result.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="py-6 border-t border-gray-800">
        <div className="container mx-auto text-center text-gray-500 text-sm">
          <p>TruthSeeker © {new Date().getFullYear()} • Claim Verification System</p>
        </div>
      </footer>
    </div>
  )
}

