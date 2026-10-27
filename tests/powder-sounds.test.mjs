import assert from 'node:assert/strict';
import test from 'node:test';
import {powderSoundLevels} from '../dist/powder-sounds.js';

const silent=levels=>assert.deepEqual(levels,{scoop:0,sift:0});

test('pickup begins after movement starts and both actions share the same soft scoop',()=>{
  for(const type of ['powder','sieve']){
    silent(powderSoundLevels(type,0));silent(powderSoundLevels(type,.03));
    const entering=powderSoundLevels(type,.04),working=powderSoundLevels(type,.12);
    assert.ok(entering.scoop>0&&entering.scoop<working.scoop);
    assert.ok(working.scoop>0&&working.scoop<.5);assert.equal(working.sift,0);
  }
  assert.deepEqual(powderSoundLevels('powder',.15),powderSoundLevels('sieve',.15));
});

test('direct powder uses a quieter grain fall while sifting has its own texture',()=>{
  const direct=powderSoundLevels('powder',.5),sieve=powderSoundLevels('sieve',.5);
  assert.ok(direct.scoop>0);assert.equal(direct.sift,0);
  assert.equal(sieve.scoop,0);assert.ok(sieve.sift>direct.scoop);
  assert.ok(direct.scoop<powderSoundLevels('powder',.15).scoop,'falling powder is softer than the pickup');
  assert.equal(powderSoundLevels('sieve',.25).sift,0,'sifting does not begin before visible particles');
  assert.ok(powderSoundLevels('sieve',.30).sift>0);
});

test('grains fade while particles are visible and the returning tool is silent',()=>{
  for(const type of ['powder','sieve']){
    const full=powderSoundLevels(type,.5),leaving=powderSoundLevels(type,.76);
    assert.ok(leaving.scoop+leaving.sift>0);
    assert.ok(leaving.scoop+leaving.sift<full.scoop+full.sift);
    for(const p of [.8,.81,.95,1,2,Number.POSITIVE_INFINITY])silent(powderSoundLevels(type,p));
  }
});

test('the complete action stays finite, quiet, and continuous at onset and release',()=>{
  for(const type of ['powder','sieve']){
    let previous={scoop:0,sift:0};
    for(let step=0;step<=1000;step++){
      const level=powderSoundLevels(type,step/1000);
      for(const channel of ['scoop','sift']){
        assert.ok(Number.isFinite(level[channel])&&level[channel]>=0&&level[channel]<=.5);
        assert.ok(Math.abs(level[channel]-previous[channel])<.02,'smooth windows avoid hard per-frame level changes');
      }
      previous=level;
    }
    for(const boundary of [.03,.25,.28,.8]){
      const before=powderSoundLevels(type,boundary-.000001),after=powderSoundLevels(type,boundary+.000001);
      assert.ok(Math.abs(before.scoop-after.scoop)<.0001);assert.ok(Math.abs(before.sift-after.sift)<.0001);
    }
  }
});

test('inactive, interrupted, or invalid actions clear a reusable snapshot without allocation',()=>{
  const out={scoop:0,sift:0};
  assert.equal(powderSoundLevels('sieve',.5,out),out);assert.ok(out.sift>0);
  assert.equal(powderSoundLevels(null,.5,out),out);silent(out);
  for(const type of ['serve','whisk','ice','',undefined]){out.scoop=out.sift=1;powderSoundLevels(type,.5,out);silent(out);}
  for(const p of [Number.NaN,undefined,null,-1]){out.scoop=out.sift=1;powderSoundLevels('powder',p,out);silent(out);}
  powderSoundLevels('sieve',.5,out);assert.ok(out.sift>0);
  powderSoundLevels('powder',.5,out);assert.equal(out.sift,0);assert.ok(out.scoop>0,'switching action cannot keep the former texture active');
});
