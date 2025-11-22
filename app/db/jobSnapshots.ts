import type { AdapterJob, AdapterRawJson } from "@/app/api/data-ingestion/adapters/types";
import crypto from "crypto";


//Fields in job_snapshots table (type definition)
export type dbJobSnapshot = {
  job_id: string;
  snapshot_at?: string; 
  ats_updated_at: string | null; 
  raw_json: AdapterRawJson; 
  content_hash: string; 
  metadata_hash: string; 
  content_simhash: string; //Simhash of content (stored as string, converted from bigint)
  metadata_simhash: string; 
};



/**
 * Generate SHA-256 hash of job content
 * returns: SHA-256 hash as hex string
 */
export function generateContentHash(content: string | null): string {
  const text = content || "";
  return crypto.createHash("sha256").update(text).digest("hex");
}


/**
 * Generate SHA-256 hash of job metadata 
 * returns: SHA-256 hash as hex string
 */
export function generateMetadataHash(jobData: AdapterJob): string {
  //Extract key metadata fields 
  const metadata = {
    title: jobData.title,
    company_name: jobData.company_name,
    location: jobData.location,
    first_published: jobData.first_published,
    updated_at: jobData.updated_at,
    requisition_id: jobData.requisition_id,
  };
  
  //Convert to JSON string for hashing (sorted keys for consistency)
  const metadataString = JSON.stringify(metadata, Object.keys(metadata).sort());
  return crypto.createHash("sha256").update(metadataString).digest("hex");
}



/**
 * Generate simhash for fuzzy similarity detection
 * Simhash produces similar hashes for similar content 
 * 
 * Algorithm:
 * 1. Tokenize text into words
 * 2. Hash each word with SHA-256
 * 3. For each bit position, accumulate +1 or -1 based on token hashes
 * 4. Final hash has bit=1 if accumulator>0, bit=0 if accumulator<=0
 * 
 * param: text 
 * returns: 64-bit simhash as bigint
 */
export function generateSimhash(text: string): bigint {
  const HASH_BITS = 64;
  const weights = new Array(HASH_BITS).fill(0);
  
  if (!text || text.trim().length === 0) {
    return BigInt(0);
  }
  
  //Tokenize: split on whitespace and normalize
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") //Remove punctuation
    .split(/\s+/)
    .filter(token => token.length > 0);
  
  if (tokens.length === 0) {
    return BigInt(0);
  }
  
  //For each token, hash it and update weights
  for (const token of tokens) {
    const hash = crypto.createHash("sha256").update(token).digest();
    
    //Process each bit of the hash
    for (let i = 0; i < HASH_BITS; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      const bit = (hash[byteIndex] >> bitIndex) & 1;
      
      //If bit is 1, add weight; if 0, subtract weight
      weights[i] += bit ? 1 : -1;
    }
  }
  
  //Generate final simhash: bit is 1 if weight > 0
  let simhash = BigInt(0);
  for (let i = 0; i < HASH_BITS; i++) {
    if (weights[i] > 0) {
      simhash |= (BigInt(1) << BigInt(i));
    }
  }
  
  return simhash;
}



/**
 * Create a snapshot object for database insertion
 * Computes all hashes 
 * 
 * returns: Complete snapshot object with all hashes computed
 */
export function createSnapshotData(
  jobId: string,
  jobData: AdapterJob
): dbJobSnapshot {
  const content = jobData.content || "";
  
  //Generate all hashes
  const contentHash = generateContentHash(content);
  const metadataHash = generateMetadataHash(jobData);
  const contentSimhash = generateSimhash(content);
  
  //For metadata simhash, convert metadata to string
  const metadataString = JSON.stringify({
    //extract these fields from metadata
    title: jobData.title,
    company_name: jobData.company_name,
    location: jobData.location,
  });
  const metadataSimhash = generateSimhash(metadataString);
  

  //Return snapshot object
  return { 
    job_id: jobId,
    ats_updated_at: jobData.updated_at,
    raw_json: jobData.raw_json, 
    content_hash: contentHash,
    metadata_hash: metadataHash,
    content_simhash: contentSimhash.toString(), //Convert bigint to string for DB
    metadata_simhash: metadataSimhash.toString(),
  };
}




/**
 * Quick check if content has changed between two snapshots
 * Compares hashes only (content and metadata)
 * 
 * returns: true if any hash differs (content or metadata changed)
 */
export function hasContentChanged(
  oldSnapshot: dbJobSnapshot,
  newSnapshot: dbJobSnapshot
): boolean {
  return (
    oldSnapshot.content_hash !== newSnapshot.content_hash ||
    oldSnapshot.metadata_hash !== newSnapshot.metadata_hash
  );
}
