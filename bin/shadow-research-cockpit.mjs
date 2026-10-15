#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { createResearchCockpitServer } from '../lib/research-cockpit.js';
const args=process.argv.slice(2);
if(args.length<2 || args[0]!=='--collection') {console.error('Usage: --collection COLLECTION_JSON [--output-dir DIRECTORY] [--port PORT]');process.exit(2);}
const options={};for(let i=0;i<args.length;i+=2){if(!['--collection','--output-dir','--port'].includes(args[i])||!args[i+1]||options[args[i]])process.exit(2);options[args[i]]=args[i+1];}
const output=resolve(options['--output-dir']??'/tmp/shadow-research-'+Date.now());
const port=Number(options['--port']??8767);
if(!Number.isInteger(port)||port<0||port>65535)process.exit(2);
const server=createResearchCockpitServer({collection:JSON.parse(readFileSync(options['--collection'],'utf8')),outputDir:join(output,'reports'),ledgerDir:join(output,'ledger')});
server.on('error',(error)=>{console.error(error.code);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('Shadow Research Desk: http://127.0.0.1:'+server.address().port));
