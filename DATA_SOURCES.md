# Data Sources

All data served by `fema-disaster-declarations-aid-mcp` is read live at call time from the official public OpenFEMA API (no API key required):

- **FemaWebDisasterDeclarations (v1)** (`https://www.fema.gov/api/open/v1/FemaWebDisasterDeclarations`): Official disaster-level declarations (Major Disasters, Emergencies, Fire Management Assistance), incident dates, declared programs, and FEMA.gov disaster URLs.
- **DisasterDeclarationsSummaries (v2)** (`https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries`): County, parish, borough, and tribal designated areas for every federal disaster declaration since 1953, including FIPS codes and Individual Assistance filing deadlines.
- **FemaWebDisasterSummaries (v1)** (`https://www.fema.gov/api/open/v1/FemaWebDisasterSummaries`): Official disaster-level federal funding totals, including approved Individual Assistance applications, Individuals and Households Program (IHP) dollars, Housing Assistance, Other Needs Assistance, Public Assistance obligated dollars (emergency work Categories A-B vs permanent work Categories C-G), and Hazard Mitigation Grant Program (HMGP) obligations.
