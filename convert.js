const jks = require('jks-js');
const fs = require('fs');

// 1. Apni .jks file ka naam yahan likhein
const keystorePath = './@asitdas123__vetansutra.jks'; 

// 2. Jo password aapne dekha tha, use yahan likhein
const password = 'da23b942269a2dcc681d47e03ce93e3e'; 

// 3. Jo Alias humne nikala hai (Keystore scan ke mutabiq '0' hai)
const alias = '0'; 

try {
    const data = fs.readFileSync(keystorePath);
    
    let keystore;
    if (typeof jks.parseJks === 'function') {
        keystore = jks.parseJks(data, password);
    } else if (typeof jks.toObject === 'function') {
        keystore = jks.toObject(data, password);
    } else {
        throw new Error('jks-js module exports something unexpected.');
    }

    const aliases = Object.keys(keystore);
    console.log('Available aliases in keystore:', aliases);
    
    if (aliases.length === 0) {
        throw new Error('No aliases found in keystore.');
    }

    // Try the provided alias first, then the first one found
    const targetAlias = keystore[alias] ? alias : aliases[0];
    console.log(`Using alias: "${targetAlias}"`);
    
    const entry = keystore[targetAlias];
    // Based on entry details: certType, alias, date, chain, protectedPrivateKey
    const cert = entry.cert || entry.certificate || (entry.chain && entry.chain[0]);
    
    if (!cert) {
        console.log('Entry details:', Object.keys(entry));
        throw new Error(`Certificate not found for alias "${targetAlias}".`);
    }

    // Handle cert if it's an object or Buffer
    let certBuffer;
    if (Buffer.isBuffer(cert)) {
        certBuffer = cert;
    } else if (cert.encoded && Buffer.isBuffer(cert.encoded)) {
        certBuffer = cert.encoded;
    } else if (cert.value && Buffer.isBuffer(cert.value)) {
        certBuffer = cert.value;
    } else {
        console.log('Cert keys:', Object.keys(cert));
        throw new Error('Certificate data is in an unknown format.');
    }
    
    // PEM format mein badalna
    const pem = `-----BEGIN CERTIFICATE-----\n${certBuffer.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`;
    
    fs.writeFileSync('./upload_certificate.pem', pem);
    console.log('✅ Success! upload_certificate.pem file ban gayi hai.');
} catch (e) {
    console.error('❌ Error:', e.message);
}
