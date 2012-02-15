# Hapi Query Validation: Evaluations & Proposal

Author: Van Nguyen <vnguyen@walmart.com>
Date: Wed Feb 15 2012 17:30:00 GMT-0800 (PST)
RE: brisbane.onjira.com/browse/BLAMMO-4

## Introduction & Design Goals
My current interpretation of Hapi: Hapi is an (eventually) open-source API server designed to reverse proxy & cache requests to Walmart's Java API (mobile.walmart.com).  As such, Hapi should be fast, secure, and stable.  

As an intermediate, Hapi inherently adds some unavoidable latency - particularly for initial, uncached requests. This latency should be minimized as much as possible.

As a publically accessible endpoint, Hapi will be exposed to the elements.  Hapi should not be vulnerable to security exploits (e.g. improper UTF-16 handling & buffer overflows).  

The protected API may not change that often but Hapi should have some element of configurability.  It should also be highly stable - TODO: finish this intro

## Query Validation: The Problem


## Overview of Solutions
The following list of evaluated solutions is a small sampling of the infinitely many possible solutions.  They are presented in order of ascending effectiveness.

### Factory Function

### Global Types

### Type Registry

## Proposed Solution