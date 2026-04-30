/*
 * Minimal ZIP writer focused on the constraints EPUB imposes:
 *   - The first entry must be `mimetype`, stored uncompressed.
 *   - All other entries can be deflate-compressed.
 *   - Standard CRC-32, local file headers, and central directory.
 *
 * Implements just enough of PKZIP APPNOTE.TXT (4.4) to produce a valid
 * archive readable by Calibre, kindlegen / Kindle Previewer, Apple Books,
 * and KDP's ebook converter. No ZIP64, no encryption, no multi-disk.
 */

import { deflateRawSync } from "node:zlib";

const SIGN_LOCAL = 0x04034b50;
const SIGN_CD = 0x02014b50;
const SIGN_EOCD = 0x06054b50;
const VERSION_NEEDED = 20; // 2.0
const VERSION_MADE_BY = 0x031e; // Unix host, version 3.0
const COMP_STORE = 0;
const COMP_DEFLATE = 8;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Convert a JS Date (or current time) to MS-DOS modified time/date.
function dosDateTime(date) {
  const d = date || new Date();
  const seconds = Math.floor(d.getSeconds() / 2);
  const minutes = d.getMinutes();
  const hours = d.getHours();
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear() - 1980;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = (year << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function writeLocalHeader(entry) {
  const nameBuf = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(SIGN_LOCAL, 0);
  header.writeUInt16LE(VERSION_NEEDED, 4);
  header.writeUInt16LE(0x0800, 6); // bit 11 = UTF-8 names
  header.writeUInt16LE(entry.method, 8);
  header.writeUInt16LE(entry.dosTime, 10);
  header.writeUInt16LE(entry.dosDate, 12);
  header.writeUInt32LE(entry.crc32, 14);
  header.writeUInt32LE(entry.compressedSize, 18);
  header.writeUInt32LE(entry.uncompressedSize, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuf]);
}

function writeCentralEntry(entry) {
  const nameBuf = Buffer.from(entry.name, "utf8");
  const header = Buffer.alloc(46);
  header.writeUInt32LE(SIGN_CD, 0);
  header.writeUInt16LE(VERSION_MADE_BY, 4);
  header.writeUInt16LE(VERSION_NEEDED, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(entry.method, 10);
  header.writeUInt16LE(entry.dosTime, 12);
  header.writeUInt16LE(entry.dosDate, 14);
  header.writeUInt32LE(entry.crc32, 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.uncompressedSize, 24);
  header.writeUInt16LE(nameBuf.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  // Unix file mode 0644 in upper 16 bits of external attrs
  header.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  header.writeUInt32LE(entry.localHeaderOffset, 42);
  return Buffer.concat([header, nameBuf]);
}

function writeEOCD({ count, cdSize, cdOffset }) {
  const buf = Buffer.alloc(22);
  buf.writeUInt32LE(SIGN_EOCD, 0);
  buf.writeUInt16LE(0, 4); // this disk number
  buf.writeUInt16LE(0, 6); // disk where central directory starts
  buf.writeUInt16LE(count, 8); // entries on this disk
  buf.writeUInt16LE(count, 10); // total entries
  buf.writeUInt32LE(cdSize, 12); // size of central directory
  buf.writeUInt32LE(cdOffset, 16); // offset of central directory
  buf.writeUInt16LE(0, 20); // comment length
  return buf;
}

/**
 * Build a ZIP buffer from a list of files.
 * Each file is { name, data, store }. `store: true` forces uncompressed
 * (required for EPUB's `mimetype` entry).
 */
export function buildZip(files, options) {
  const date = (options && options.date) || new Date();
  const { dosTime, dosDate } = dosDateTime(date);

  const localChunks = [];
  const centralChunks = [];
  const entries = [];
  let offset = 0;

  for (const file of files) {
    const data = Buffer.isBuffer(file.data)
      ? file.data
      : Buffer.from(file.data, "utf8");
    const store = !!file.store;
    const compressed = store ? data : deflateRawSync(data, { level: 9 });
    const entry = {
      name: file.name,
      method: store ? COMP_STORE : COMP_DEFLATE,
      crc32: crc32(data),
      compressedSize: compressed.length,
      uncompressedSize: data.length,
      dosTime,
      dosDate,
      localHeaderOffset: offset,
    };
    const localHeader = writeLocalHeader(entry);
    localChunks.push(localHeader, compressed);
    offset += localHeader.length + compressed.length;
    entries.push(entry);
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const entry of entries) {
    const cd = writeCentralEntry(entry);
    centralChunks.push(cd);
    cdSize += cd.length;
  }

  const eocd = writeEOCD({ count: entries.length, cdSize, cdOffset });

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}
