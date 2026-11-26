import test from 'node:test';
import assert from 'node:assert/strict';
import {carregarBaseSgm} from '../src/sgm_data_adapter.mjs';
const data=Array.from({length:3366},(_,i)=>({
 os_id:'M-'+String(i).padStart(4,'0'),source_position:i,
 opened_on:i<2601?'2025-01-01':'2020-01-01',
 in_v549_24m_balance:i<2198,
 original_os:{id:'M-'+String(i).padStart(4,'0')}
}));
function mock(rows=data){
 return {from(table){
  if(table==='sgm_campaigns') return {select(){return this},eq(){return this},async single(){return {data:{
   id:'test',code:'v549-base-integral-2026-11-09',expected_count:3366,
   original_metadata:{refdate:'2026-11-09'},sites_catalog:[],staff_catalog:[]},error:null}}};
  if(table==='sgm_orders')return {select(){return this},eq(){return this},order(){return this},
    async range(a,b){return {data:rows.slice(a,b+1),error:null}}};
  throw Error('unexpected table');
 }};
}
test('base completa preserva ordem, 3366 e balanço 2198',async()=>{
 const r=await carregarBaseSgm(mock());
 assert.equal(r.base.rows.length,3366);assert.equal(r.check.balanco24,2198);
 assert.equal(r.base.rows[0].id,'M-0000');assert.equal(r.base.rows.at(-1).id,'M-3365');
});
test('não aceita base incompleta',async()=>{
 await assert.rejects(()=>carregarBaseSgm(mock(data.slice(0,3000))),/incompleta/);
});
test('não aceita recorte 24m divergente',async()=>{
 const rows=data.map((r,i)=>i===1?{...r,opened_on:'2018-01-01'}:r);
 await assert.rejects(()=>carregarBaseSgm(mock(rows)),/divergentes/);
});
