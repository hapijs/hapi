import { createBrotliCompress, createBrotliDecompress, createDeflate, createGunzip, createGzip, createInflate } from 'zlib';

/**
 * Available [content encoders](https://github.com/hapijs/hapi/blob/master/API.md#-serverencoderencoding-encoder).
 */
export interface ContentEncoders {

    deflate: typeof createDeflate;
    gzip: typeof createGzip;
    br: typeof createBrotliCompress;
}

/**
 * Available [content decoders](https://github.com/hapijs/hapi/blob/master/API.md#-serverdecoderencoding-decoder).
 */
export interface ContentDecoders {

    deflate: typeof createInflate;
    gzip: typeof createGunzip;
    br: typeof createBrotliDecompress;
}
