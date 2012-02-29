# Hapi Route Configuration Proposal

* Author: Van Nguyen <vnguyen@walmart.com>
* Date: Wed Jan 11 2012 13:30:00 GMT-0800 (PST)

## Pre-introduction

This document was created as part of my interview process at @WalmartLabs.

## Introduction

Based on the exercise requirements, it doesn't seem to "require" a lot of coding.  This is more of a basic attempt at a persuasive proposal.  If you agree with the solution described here, I'd be happy to code it up - but not for free!

**Breakdown**

1. Situation: Postmile's route config is not easy to edit, not __powerful__ enough; could be improved.
2. Tasks: Create a new route config format that is easier to edit, more powerful.
3. Actions: Utilize two primary dimensions for improvement: data structure selection & convention over configuration.
4. Results:  Replace tabular list with path tree & establish conventions => fewer bugs, precise control, easy to edit.
5. Aftermath: TBD


### Assumptions

    "Powerful": |ˈpou(-ə)rfəl| : adj
      "Capacity or performance of an engine or other device"
      "The capacity or ability to direct or influence the behavior of others or the course of events"
      ...

For the purposes of this exercise, my definition is the more practical "Capable, terse, convenient, precise, and fast".  This definition of `powerful` is roughly how I direct my effort and gauge validity.  

I also assume that the config format's design should *encourage* more RESTful design patterns.  Frameworks have a surprisingly high potential for conditioning that is often underutilized.  Among other techniques, by using smart, meaningful error messages, you can nudge the developer in the "right" direct as if they were cattle... or emus.    


## Applied Data Structs

URI's are like file system paths - they are naturally organized as trees [1].  The two paths `/dev/null` and `/dev/random` share a base path.  It is slightly more efficient to organize them as a tree where the indented values extend the parent:

    /dev
      /null
      /random
    /etc

In the same vein, an operating system level file system that included the full path for every possible path would waste a lot of space with little to no performance or clarity gain. There are other systems that exhibit similar preferences [2].

The original routes list or table forces that natively tree-like structure into a verbose, unorganized array - this generates subtle and potentially serious unintended consequences.  
  
[1] I'm operating under the assumption that Postmile's router doesn't already parse the table into a tree format.  However, even if it did, most of the benefits come from working directly with the tree - like brevity.

[2] CSS is another system whose original naive implementation follows a similar fate.  Modern designers and developers alike will prefer to use a framework that incorporates features like nesting, variables, etc (like Sass or Less).  Nesting selectors allows for more intuitive modeling, enables more space-efficient file searching, and encourages code reuse.  

Meanwhile, in another industry, some proteins in the human body mimic Lisp's `car` & `cdr` methods on other protein chains.  This suggests that those proteins also use a tree or "nested list" structure - code as data, data as biological code!  This anecdote is brought to you without citation (it was in one of my undergrad biology textbooks, who knows).

### &lt;ul&gt;&lt;li&gt;Evil&lt;/li&gt;&lt;ul&gt;

Because of the list format, the web framework responsible for routing must iterate through the list and generate routes.  This allows for the existence of duplicate paths (sprinkled throughout the table/list) and allows for issues with execution order.  

For example, if we unknowingly introduced a duplicate route at the end of the table like this:

    ...
      { method: 'GET',    path: '/task/:id',      handler: Task.getter } // original handler used Task.get
    ];

Then, in most routing systems, which loop through routes from the top, only the first one would be used (in this case, it is not a mistake). In an optimized tree structure, useless duplicates easy to find due to locality of reference - you cannot have duplicates at opposite ends of the config file.

Many routers are vulnerable to issues with route order.  Hypothetical example:

    ...
      { method: 'GET',    path: '/user/:id',      handler: User.get },
      { method: 'GET',    path: '/user/edit',     handler: User.edit },
    ...

Again, the router iterates through the list of paths.  Once it finds a match, it breaks off and follows the configuration.  Since the :id path is first AND the type of :id is not specified (and thus matches anything), the string "edit" is treated as an valid match to :id.  This means the route "/user/edit" gets handled by User.get and never sees User.edit.  This is obviously not the intent.  The tabular solution is to switch the order of the routes (and to a lesser extent: use typed :keys).

The above are simple examples that hint at how difficult it can be to foresee, debug, and manage list-based routing in large projects.

### Disadvantages of Trees

#### Relative Complements: Computers >> Humans
The tree structure I propose uses some inheritence for options (opts: {}) which get applied to all descendent controllers. 

Let's assume all controllers use the base opts.  But, later down the line, you add a new controller that should not have the inherited options.  It is not immediately obvious visually that the options will get passed down.  The computer can't really determine whether you intended to use the base opts or not.  

This may have subtle, unintended consequences that differ depending on the controller you are implementing. But if anyone runs into this issue, I suggest eliminating that small feature for a more explicit approach where you can still reuse chunks:

    var _ = require("underscore");
    var profile_opts = { tos: 'none' };

    exports.endpoints = {
      ...
      "/profile": {
        base: User, 
        post: _.extend({ data: User.type.user }, profile_opts), // "inherits" base_opts
        "/email": {
          post: { handler: User.email, data: User.type.email }}} // does not use base_opts
      ...
    };

This design pattern also enables you to add mixins.  You can mixin multiple objects using the `_.extend` function [3]: 

    _.extend({ data: List.type.user}, profile_opts, user_opts, admin_opts)

[3] FYI: right argument(s) will overwrite overlapping keys to the left arg.  Also, _.extend should only copy keys one layer deep - it does not do deep copy, for that, roll your own extend.  

#### On the Engineering Tradeoffs of Eyeballs
Unfortunately, with trees, we're argueably trading human-scannability for clarity, precision, & performance.  Without syntax highlighting, the tree format is much more difficult to grok visually than the standard tabular list format. 

Fortunately, with syntax highlighting (and perhaps dynamic tab width control), the readability is still reasonable.  As mentioned in advantages section, tabular format output is possible.

#### RESTful Rebels
Another potential disadvantage is in building non-RESTful APIs.  If you don't want to conform to strict RESTful conventions, a lot of the boilerplate reduction and benefits would be lost.  

#### Trading Subtleties
When combined with convention-over-configuration, a lot of boilerplate is eliminated since the router can find a controller at route.base[http_method].  However, if you mix and match http verbs, this could become a problem.

    ...
    "/projects": {
          get: { handler: Projects.list }, // override GET since using nonstandard handler
          put: { handler: Projects.put, data: Project.type.put }, // no base here to avoid conflict with /:id's base
          "/:id": {
            base: Projects,
    ...

In the above schema, making a request to `PUT "/projects/:id"` will attempt to use Projects.put which is meant for `PUT "/projects"`.  However, a router with a smart parsing function could easily detect this type of conflict and surface meaningful error messages to encourage proper behavior.

### Advantages of Trees

### Resource Reuse, Recycle, Reduce
It isn't illustrated in the modified.routes.js, however, it is possible to map one resource to multiple URIs.  For example, "/projects/:id/suggestion" maps to a Suggestion method in Projects *controller*.  It could map to a Suggestion *controller* which is also used for the route: "/suggestion/:project_id".
    
    ...
    "/project/:id": {
      ...
      "/suggestion": {
        base: Suggestion}
    },
    ...
    "/suggestion/:id": {
      base: Suggestion},
    ...

Notice that both routes conveniently supply the same parameter :id.

This paradigm forces low-level functions to uniformly short URIs and makes it easier to employ composites (mentioned in the Misc section).  

This feature demonstrates the `capable` feature of the "powerful" definition.  The ability to move and copy functionality around extends the capability of the API.


### Compression
The tree version of the routes has **3073** chars versus the tabular's **5283** chars - 42% less chars!  However, the number of lines nearly doubles from **48** to **88**.  Average width is about halved in the tree version so surface area is probably about the same.  Also, some method handlers could be wrapped with the previous line but aren't for clarity. 

As touched on in modified.routes.js notes, when using YAML style whitespace style, the following metrics are maximized:

    info density = ρ = (meaningful content / px^2), where px = pixel
    SNR = ρ / ε, where ε is useless junk

Assuming each character introduces a probability for bugs P(bug)...  assuming that P isn't a function of ρ...

### Format Switching
I expect that router will traverse, parse, and validate the tree config.  Once parsed, it is trivial to output the route list in a tabular format for visual scanning.  The reverse (converting tabular to tree) is trickier due to so many edge cases to account for but it is not impossible.  

This makes the tree method `convenient`.  

### Route Order
Route order is mostly a non-issue.  The tree config format forces similarly prefixed routes to sit next to each other (locality of reference for the win!).  Thus, it is easy to recognize (and automatically report) overlapping routes.  

This makes the tree method `precise`.

#### Searching & Auto-documentation
For the process of routing, the system normally either loops through the entire route table for each request (less memory but slow) or uses an additional hash table (fast but slightly more memory on top of route list).  

With respect to auto-documentation & self-documenting requests (returning documentation through a HEAD or OPTIONS request, for example), by the time the router has matched the request.url using a tree, it already has fast access to relative routes.  This means HEAD requests to `/projects` could quickly generate and display documentation for `/projects/:id/participants` and vice versa (if doubly linked).  Tabular routers don't usually exploit LOR (locality of reference) and thus must loop.  

With a tree, it is O(log n) search time vs loop's O(n) - yay!  Not a huge win in practice though.  But if a 1% performance gain overall saves you millions, maybe it is worth it?

Tree traversal is slower than a hash table though. So actual performance depends on the production use cases.

Overall, this sort of makes the tree method `fast`.  Brevity (compression) also contributes to making it `fast` to create, read, update, delete routes...

## Convention over Configuration

By employing a non-prescriptive convention, we can remove a lot more of the boilerplate while still allowing devs to do whatever they desire.  

If all handlers followed a more RESTful naming scheme (ex: `GET '/user/:id'` => User.show), some routes could be replaced to a single line (subpath key & handler: ex:  `"/user": { handler: User }`).  Note that this is different from:  `"/user": { get: { handler: X }}`.

Also, notice that we are basically just nesting key-value objects.  The difference between a path and a normal key is the "/" prefix on the key.  This makes it easy to programmatically tell the difference between path substring and an HTTP or special method.  

A dev could still be as verbose as they wanted with the route config: make every handler explicit, mix and match handlers, etc.  Interestingly, this enables the idea of measuring how RESTful the API is:
  
    d = (v*r - δ) / (v*r), where r = # of routes, v = # of http verbs used, δ is the number of explicit verbs in config

## Conclusion

The tree form of the config looks very weird to me though.  It is not a very common interface.  It would take getting used to. It is neither perfect nor battle-hardened.  But, it fits the demanded criteria pretty well and may be worth investigating further.




## Misc Issues with Current Routing Config

Here is a list of *arguable* general API design issues.
 
*   Some paths overlap.

    (`/user/lookup/...` could match `/user/:id/...`).  
  
    Depending on your use cases, it may be better to employ parallel or normalized namespacing:
    
        "/user/get/:id" // instead of "/user/:id"
        "/user/lookup/:type/:id"

    Using the tree structure, it becomes pretty easy to nest and reuse resources. 

    `/user/lookup/:type/:id` could map to a Lookup controller which is also used for `/lookup/:type/:id`.

    Example of use-case-dependency:  If the API is used by users who only ever access their own `:id`'s data, then `:id` can be replaced with session data.  Then, namespacing doesn't matter.

*   Use composite resources
    Again, depends on your use cases, but: 

    Have standard RESTful interfaces for a given resource (like User) but support extra composite resources that combine frequently used handlers to reduce requests and increase cache-ability.

    Standard flow:
        `GET "/user/data/:id"` => gets user :id's data, which lets say includes lists of user's project ids, task ids, etc
        `GET "/projects/:id"` => do this for each project id
        `GET "/tasks/:id"` => for each task id

    Composite:
        `GET "/user/desktop/:id"` => gets all above data for user :id

    The composite URL lets the user start interacting their data after only a single request.  The compose-able nature of this design pattern lets you build your API on two levels - low and high.  The composite is a high level request; partials made by composite, low.  

    High level composites make it easier to make consumer facing applications because developers can do more work in fewer requests = less code = finish faster.

    Even clients/users could create their own composites.  

*   Does not take into account API versioning & backwards compatibility

    Use semver for fast releases like:

        "/v0.1.0/user/:id"...
        "/v1.2.0/user/:id"...
        "/latest/user/:id"...
        ...

    Or alternatively:

    `/:year/user/:id` or `/v1/user/:id` for slow, monotonic releases


















