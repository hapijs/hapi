# Hapi Query Validation Configuration Proposal

* Author: Van Nguyen <vnguyen@walmart.com>
* Date: Wed Feb 29 2012 12:30:00 GMT-0800 (PST)

## Some Approaches

* Objects
* Objects w/ helpers
* DSL

Example Route/Endpoint Config:

    { method: 'GET',    path: '/contacts',                      handler: User.contacts,         query: ['exclude'], tos: 'none' }

### Design Considerations

TODO

### Objects

    query: {"email": {type: "String"}} // use defaults
    query: {"username": {type: "String", required: false}} // optional parameter
    query: {"password": {type: "String", min: 6}} // override settings
    query: {"email": {type: "String"}, "password": {type: "String"}} // multiple params
    
    // relationships
    query: {"CreditCardNumber": {type: "String", "AND": ["Name", "Expiration", "Code"]}, "Name": {type: "String", "AND": ["CreditCardNumber", "Expiration", "Code"]}, "Expiration": {type: "String", "AND": ["Name", "CreditCardNumber", "Code"]}, "Code": {type: "String", "AND": ["Name", "Expiration", "CreditCardNumber"]}} // all or nothing
    query: {"access_token": {type: "String", "XOR": ["password"]}, "password": {type: "String", "XOR": ["access_token"]}} // XOR

* Straightforward, no-nonsense approach: just the data
* Fairly performant
* Easily understood by devs
* Can become quite verbose

### Objects w/ helpers functions

    // T = Types.ensure
    query: {"email": T("String")}
    query: {"username": T("String", {required: false})} 
    query: {"password": T("String", {min: 6})}
    query: {"email": T("String"), "password": T("String")} // multiple params
    
    // relationship
    var CC_GRP = ["CreditCardNumber", "Name", "Expiration", "Code"];
    query: {CreditCardNumber: T("String").with(CC_GRP), Name: T("String").with(CC_GRP), Expiration: T("String").with(CC_GRP), Code: T("String").with(CC_GRP)} // all or nothing
    query: {access_token: T("String").xor("password"), password: T("String").xor("access_token")} // XOR

* T() returns Object from "Object" section
* Dubious added value unless pre-executed to form new endpoint/routes before server start
* Similar style used by rackspace's swiz

### DSL

    query: ["String#email"] // uses defaults
    query: ["String#username?"] // optional param
    query: ["String#password.min(6)"] // modify params
    query: ["String#email", "String#password"] // multiple params
    
    // relationships
    query: ["String#CreditCardNumber < String#Name + Datetime#Expiration + String#Code"] // all or nothing
    query: ["String#access_token | String#password"] // XOR
    query: ["String#a.group(items) + String#b.group(items) + String#c.group(items)"] // Generalized grouping

* Lowest average verbosity
* Human-readable
* Requires additional processing/cpu cycles to parse, could be pre-processed like Obj w/ helpers fn for performance



