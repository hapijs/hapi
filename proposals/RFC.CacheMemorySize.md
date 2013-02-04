# Hapi Memory Cache Size Restrictions

* Author: Wyatt Preul <wlyonpreul@walmart.com>

## Memory Cache Size

The following document details a proposal for allowing the memory cache strategy to be restricted with a maximum size.

## Proposed Solution 1

A very simple solution to this problem is to limit the size by a maximum number of items that can be cached.

### Pros
This solution should be very fast.  The cache.length will be checked and if it is at the threshold then no item will be added to the cache.

### Cons
This is a rough solution as objects occupying a large amount of memory could still be cached as long as the total number of objects is below the threshold.  Therefore, this will only serve the purpose of providing a limit in general, one that may not be all that useful for those trying to limit memory consumption.


## Proposed Solution 2

A slightly more complex solution, this would iterate over each item stored in cache and calculate the size of the cache in bytes.  This could be optimized so that when an object is added or removed the size value is updated instead of recalculating the cache size for every set operation.

### Pros
Far more useful for limiting the memory size of the cache as the real cache size will be limited.

### Cons
This will be more expensive to calculate than solution 1, especially when a cached item is complex, containing child objects and arrays.