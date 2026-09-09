import test from 'node:test';
import assert from 'node:assert/strict';
import { ReplayPlayer } from '../src/replay-player.js';
function harness(){
 let next=0;const queue=new Map(),times=[];
 const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;
 globalThis.requestAnimationFrame=fn=>{queue.set(++next,fn);return next;};globalThis.cancelAnimationFrame=id=>queue.delete(id);
 const player=new ReplayPlayer({onFrame:f=>times.push(f.t),onChange:()=>{},onEnd:()=>{}});
 const run={id:'test',duration:1,frames:[{t:0,x:0,y:0,z:0,q:[0,0,0,1],speed:0},{t:1,x:1,y:0,z:0,q:[0,0,0,1],speed:1}]};
 player.load(run);
 return {player,times,tick(time){const callbacks=[...queue.values()];queue.clear();callbacks.forEach(f=>f(time));},restore(){player.clear();globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;}};
}
test('pause freezes replay and resume resolves the original playback promise',async()=>{
 const h=harness();try{const done=h.player.play();h.tick(0);h.tick(100);h.player.pause();const time=h.player.time;h.tick(1000);assert.equal(h.player.time,time);h.player.play();for(let t=1000;t<=2400;t+=100)h.tick(t);assert.equal(await done,true);assert.equal(h.player.time,1);}finally{h.restore();}
});
test('cancel resolves interrupted playback instead of leaving the app busy forever',async()=>{
 const h=harness();try{const done=h.player.play();h.tick(0);h.player.cancel();assert.equal(await done,false);assert.equal(h.player.playing,false);}finally{h.restore();}
});
test('seeking is reversible and starting another run cancels the old one',async()=>{
 const h=harness();try{const done=h.player.play();h.player.pause();h.player.seek(.75);assert.equal(h.player.time,.75);h.player.seek(.25);assert.equal(h.player.time,.25);h.player.load({...h.player.run,id:'next'});assert.equal(await done,false);assert.equal(h.player.time,0);}finally{h.restore();}
});
