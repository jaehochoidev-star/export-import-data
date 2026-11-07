const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'기록 없음';
export function sourceStatus(status,key){
  const s=status?.sources?.[key];
  if(!s)return '<p class="update-unknown">최근 수집 상태를 확인할 수 없습니다. 아래 자료 기준일을 확인해 주세요.</p>';
  const failed=s.state==='failed';
  return `<div class="update-status ${failed?'update-failed':'update-success'}" role="status"><strong>${failed?(s.usingPreviousData?'갱신 실패 · 이전 데이터 표시 중':'갱신 실패 · 보관 데이터 없음'):'최근 수집 정상'}</strong><p>최근 시도: ${esc(time(s.lastAttemptAt))} (한국시간) · 마지막 수집 성공: ${esc(time(s.lastSuccessAt))}</p>${failed?`<p>이번 수집이 완료되지 않아 새 자료를 반영하지 못했습니다. 마지막 데이터 반영: ${esc(time(s.lastDataUpdatedAt))}</p>`:''}</div>`;
}
