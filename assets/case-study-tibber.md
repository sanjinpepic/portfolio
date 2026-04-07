# Tibber — Smart Charging Analytics

**Role:** Business Data Analyst
**Period:** September 2022 – August 2024
**Location:** Stockholm, Sweden

---

## Context

Tibber is a technology-driven energy company that lets customers buy electricity at real-time spot prices. A core product is smart EV charging — automatically scheduling charging sessions during low-price windows to save customers money.

When I joined the charging analytics team, the product was live and growing, but the analytics infrastructure was thin. Charging decisions were being made without a rigorous view of what was driving savings, where conversion dropped off, or how to price B2B partnerships and virtual power plant contracts.

My mandate was to build the analytical foundation for the charging business — and turn it into a commercial lever.

---

## Approach

### 1. Building the charging analytics team

There was no dedicated analytics function for EV charging when I arrived. I established the team, defined the core metric framework, and set the analytical agenda for three areas: market analysis, revenue development, and B2B pricing.

This meant instrumenting the product properly — defining what events to track, standardizing how savings were calculated, and creating a shared source of truth across product, commercial, and engineering.

### 2. Smart charging optimization

The core question was: how much savings potential was the product leaving on the table?

I modelled the gap between theoretical optimal charging (perfect price foresight) and actual charging outcomes, then diagnosed the root causes — forecasting errors, session constraints, grid connection limits, and user behaviour patterns.

The analysis drove a series of product and algorithm changes that reduced the gap, delivering **50M SEK in annual savings** across the customer base and improving **product conversion by 32%**.

### 3. Analytics toolstack implementation

The existing toolstack was fragmented. I led the implementation of a new stack:

- **Databricks** for scalable data processing and modelling
- **Rudderstack** for unified event tracking across product surfaces
- **AB testing platform** with a custom visualization layer for experiment analysis

This replaced a patchwork of one-off scripts and spreadsheet analyses, giving the whole company a shared infrastructure for data-driven decisions.

### 4. Virtual power plant pricing models

Tibber was building a virtual power plant (VPP) — aggregating smart charging load to participate in grid balancing markets. I designed the cost and pricing models underpinning Tibber's B2B contracts and partnership strategy for the VPP.

This involved modelling flexibility value, balancing market revenue, and customer cost attribution under different aggregation scenarios.

---

## Outcomes

- **50M SEK annual savings** delivered to customers through smart charging optimization
- **32% product conversion improvement** from analytics-driven product changes
- Charging analytics team established from scratch — defined the function, hired for it, set the agenda
- New analytics toolstack fully implemented (Databricks, Rudderstack, AB testing visualization)
- B2B pricing models built for virtual power plant contracts and partnership deals

---

## Learnings

**Instrumentation debt compounds fast.** The biggest early obstacle was not the analysis itself — it was that the underlying event data was inconsistent and partially unmapped. Fixing instrumentation unlocked everything downstream. I now treat event schema design as a product decision, not a data task.

**Optimization without a baseline is noise.** Before the gap analysis, there was no agreed view of how much savings potential the product was capturing. Establishing that baseline — and making it visible — was what turned "the algorithm should be better" into a prioritized product roadmap.

**Pricing for flexibility is genuinely hard.** VPP pricing required modelling behaviours and markets that hadn't fully matured. The lesson was to build models that were transparent about their assumptions so commercial teams could stress-test them, rather than producing a single number that looked precise but wasn't.
