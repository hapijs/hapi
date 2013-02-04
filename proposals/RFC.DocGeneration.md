# Hapi Route Documentation Generator

* Author: Wyatt Preul <wlyonpreul@walmart.com>

## Route Documentation

The following document details a proposal for generating pretty html markup describing a Hapi route.

## Overview of proposed solution

The documentation generator will leverage the existing route config object properties as input into a templating engine.  As a result of a route as well as parameters that a route supports having a description, notes, and a tags property the config object will not need to be modified.  The config details that the generator cares about will be added to a new object that can then be passed into a templating engine.  The output from the templating engine can then be output to the response or to a file that will be served up statically.

## Route documentation details

In order to keep things simple, when viewing the documentation for a route you will see all of the documentation for the methods that the route handles.  Additionally, you will also see the validation details for individual parameters that the route accepts.

## Template engine input

As mentioned previously, a simple object will be constructed from the route config that will be passed into the templating engine.  Here is an example of what this object may look like:

````
{ routes: [{
        path: "/user:id",
        method: "GET",
        description: "Retrieve a specific user.",
        notes: "",
        tags: ["user"],
        query: {
            id: { description("The user ID").required() }
        }
    },
    {
        path: "/user:id",
        method: "PUT",
        description: "Update a user.",
        notes: "",
        tags: ["user"],
        query: {
            id: { description("The user ID").required() },
            name: { description("The name for the user") }
        }
    }]
}
````

Beyond the object that describes the route there will also be a configurable object that will be passed into the template.  This can be used for specifying paths to stylesheets or perhaps a site name.  This configuration object must be specified when enabling the documentation generator.

## Template engine

Since the templates shouldn't have logic in them, mustache will be used as the template engine.  To keep things simple the template engine being used will not be swappable with the first version of the generator.  This is a feature that can be added later.

## Template

To keep things simple, a single template file will be used for generating the markup for each route.  The template can be changed easily to suite the needs of developers.

## Output

The generated markup will be in HTML, but there will not be any constraint placed on the template that enforces this.  The generator will simply return the markup and will not be concerned with writing it to a file or to a response object.

## Generator configuration

The generator will need to be enabled when instantiating a Hapi server.  This will be done by passing a documentation property to the Hapi server constructor on the config parameter.  Here is an example of what this config object will look like for enabling documentation:

````
var config = {
    docs: {
        templatePath: __dirname + '/doc.html',
        templateParams: {
            stylePath: '/css/style.css',
            contactEmail: 'dev@site.com'
        }
    }
};
````