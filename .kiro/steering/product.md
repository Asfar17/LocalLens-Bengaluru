# Bangalore Survival Assistant

A context-aware AI assistant helping users navigate life in Bangalore, India.

## Core Features

- Context-aware responses using local knowledge files (city, slang, food, traffic, etiquette)
- Persona-based adaptation: Newbie, Student, IT Professional, Tourist
- Voice input with speech-to-text transcription
- Image processing for local signage/menu interpretation
- Location-aware recommendations via Google Maps integration

## User Personas

| Persona | Tone | Focus |
|---------|------|-------|
| Newbie | Friendly, detailed | Thorough explanations, local customs |
| Student | Casual, practical | Budget-friendly options |
| IT Professional | Concise, efficient | Time-saving tips |
| Tourist | Descriptive, cultural | Must-see experiences |

## Context System

Markdown files in `/context/` provide domain knowledge:
- `city.md` - General city information
- `slang.md` - Local terminology
- `food.md` - Food recommendations
- `traffic.md` - Commute guidance
- `etiquette.md` - Cultural tips

Users can toggle which contexts are active for their queries.
