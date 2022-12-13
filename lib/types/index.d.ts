// Definitions adapted from DefinitelyTyped, originally created by:
// Rafael Souza Fijalkowski <https://github.com/rafaelsouzaf>
// Justin Simms <https://github.com/jhsimms>
// Simon Schick <https://github.com/SimonSchick>
// Rodrigo Saboya <https://github.com/saboya>
// Silas Rech <https://github.com/lenovouser>

export * from './plugin';
export * from './response';
export * from './request';
export * from './route';
export * from './server';
export * from './utils';

// Kept for backwards compatibility only (remove in next major)

export namespace Utils {
    interface Dictionary<T> {
        [key: string]: T;
    }

    type HTTP_METHODS_PARTIAL_LOWERCASE = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options';

    type HTTP_METHODS_PARTIAL = Uppercase<HTTP_METHODS_PARTIAL_LOWERCASE> | HTTP_METHODS_PARTIAL_LOWERCASE;

    type HTTP_METHODS = 'HEAD' | 'head' | HTTP_METHODS_PARTIAL;
}
