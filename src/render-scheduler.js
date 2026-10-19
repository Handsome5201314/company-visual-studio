// Static tools render on change; a real animation keeps requesting frames.
// OrbitControls change events schedule its remaining damping frames as needed.
export function createRenderScheduler(draw) {
 let pending=0,continuous=false,disposed=false;
 const invalidate=()=>{
  if(disposed||document.hidden||pending)return;
  pending=requestAnimationFrame(time=>{pending=0;draw(time);if(continuous)invalidate();});
 };
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(pending);pending=0;}else invalidate();};
 document.addEventListener('visibilitychange',visibility);
 return {
  invalidate,
  setContinuous(value){continuous=Boolean(value);invalidate();},
  dispose(){disposed=true;cancelAnimationFrame(pending);pending=0;document.removeEventListener('visibilitychange',visibility);}
 };
}
