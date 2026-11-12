# Operations-Research Dispatcher Engine (`services/dispatcher-engine`)

## Overview
An operations-research optimization service powered by **Google OR-Tools** (Constraint Programming / Routing) that calculates optimal responder assignments under post-disaster uncertainty.

## Core Features
- **Stochastic Routing Under Uncertainty**: Models dynamic environmental variables (road blockages, flooding, debris) using probabilistic edge penalty weights on the navigation graph.
- **Responder Fatigue Modeling**: Models human stamina as dynamic capacity constraints, decaying efficiency metrics over mission durations to avoid overburdening frontline teams.
- **Role & Capability Matching**: Matches incident requirements (search-and-rescue, damage-assessment, relief distribution) with assigned terminal roles.
- **Benchmark Baseline**: Includes a First-Come, First-Served (FCFS) evaluation module to benchmark optimization efficiency during research trials.
