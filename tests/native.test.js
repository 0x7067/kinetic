import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createNativeDirectory,readNativeDirectory} from '../server/native-projects.js';
import {validateNativeProject} from '../src/native-model.js';
import {Workshop} from '../src/model.js';
import {initialScene} from '../src/scene-model.js';
import {summarize} from '../server/client.js';

test('native creation produces an editable source project and preserves existing files',()=>{
  const base=mkdtempSync(join(tmpdir(),'kinetic-native-'));
  try{
    const created=createNativeDirectory(base,'my-world');
    assert.equal(created.project.version,3);assert.deepEqual(created.project.parts,[]);
    assert.equal(JSON.parse(readFileSync(join(created.directory,'package.json'))).dependencies.three,'0.186.0');
    assert.deepEqual(readNativeDirectory(created.directory).project,created.project);
    assert.throws(()=>createNativeDirectory(base,'my-world'),{code:'PROJECT_EXISTS'});
    assert.deepEqual(readNativeDirectory(created.directory).project,created.project);
    assert.throws(()=>createNativeDirectory(base,'../escape'),{code:'INVALID_PROJECT_NAME'});
  }finally{rmSync(base,{recursive:true,force:true});}
});

test('native snapshots are independent of working files and reject traversal and symlinks',()=>{
  const base=mkdtempSync(join(tmpdir(),'kinetic-native-'));
  try{
    const {directory,project}=createNativeDirectory(base,'source');
    writeFileSync(join(directory,'main.js'),'export function createProject() {}');
    assert.notDeepEqual(readNativeDirectory(directory).project.native.files,project.native.files);
    const manifest=JSON.parse(readFileSync(join(directory,'kinetic.project.json')));
    writeFileSync(join(directory,'kinetic.project.json'),JSON.stringify({...manifest,files:['../private.js']}));
    assert.throws(()=>readNativeDirectory(directory),{code:'INVALID_PATH'});
    writeFileSync(join(directory,'kinetic.project.json'),'{ invalid');
    assert.throws(()=>readNativeDirectory(directory),{code:'INVALID_MANIFEST'});
    assert.throws(()=>readNativeDirectory(join(base,'missing')),{code:'SOURCE_READ_FAILED'});
    writeFileSync(join(directory,'kinetic.project.json'),JSON.stringify({...manifest,files:['link.js']}));
    symlinkSync(join(directory,'main.js'),join(directory,'link.js'));
    assert.throws(()=>readNativeDirectory(directory),{code:'INVALID_PATH'});
  }finally{rmSync(base,{recursive:true,force:true});}
});

test('native source uses shared revision history and compact public output',()=>{
  const base=mkdtempSync(join(tmpdir(),'kinetic-native-'));
  try{
    const {project}=createNativeDirectory(base,'history');const workshop=new Workshop({project:initialScene()});
    workshop.commit(project);assert.equal(workshop.project.revision,1);
    const compact=summarize(workshop.state()).data;
    assert.equal(compact.project.native.files[0].content,undefined);
    assert.ok(compact.project.native.files[0].bytes>0);
    assert.equal(summarize(workshop.state(),true).data.project.native.files[0].content,project.native.files[0].content);
    workshop.undo(1);assert.equal(workshop.project.version,2);
    workshop.redo(2);assert.equal(workshop.project.version,3);assert.equal(workshop.project.native.id,project.native.id);
    assert.throws(()=>workshop.edit({expectedRevision:1,operations:[{type:'workspace',template:'scene'}]}),{code:'STALE_REVISION'});
    assert.throws(()=>workshop.edit({expectedRevision:3,operations:[{type:'add',part:{id:'fake'}}]}),{code:'NATIVE_SOURCE_EDIT'});
    const invalid=structuredClone(project);invalid.native.files[0].content='x'.repeat(750001);
    assert.throws(()=>validateNativeProject(invalid),{code:'INVALID_NATIVE_PROJECT'});
    invalid.native.files[0].content='\n'.repeat(600000);
    assert.throws(()=>validateNativeProject(invalid),{code:'INVALID_NATIVE_PROJECT'});
    invalid.native.files[0].content='';delete invalid.native.id;
    assert.throws(()=>validateNativeProject(invalid),{code:'INVALID_NATIVE_PROJECT'});
  }finally{rmSync(base,{recursive:true,force:true});}
});
