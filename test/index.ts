import * as Lab from '@hapi/lab';
import * as Hapi from '..';


const { expect } = Lab.types;

expect.type<Hapi.Server>(new Hapi.Server());
