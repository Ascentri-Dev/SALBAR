# Multilingual Disaster Report NLP Classifier (`services/nlp-classifier`)

## Overview
A fine-tuned transformer-based natural language processing service designed to classify and extract actionable crisis parameters from unstructured text.

## Capabilities
- **Trilingual & Code-Switched Support**: Specifically fine-tuned to parse conversational and panic-driven text in **English**, **Tagalog**, and **Cebuano**, including heavily mixed dialect (Taglish / Bislish).
- **Incident Categorization**: Maps free-form text to standardized emergency taxonomies (Structural Damage, Medical Casualty, Flood Inundation, Landslide, Supply Need).
- **Urgency Scoring**: Computes severity scores to assist the dispatch engine in prioritization.
- **Entity Extraction**: Identifies approximate landmark references, victim counts, and specialized assistance needs.
