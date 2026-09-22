precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec4 uSound;
uniform float uPulse;
uniform float uMotion;
uniform float uDuration;

float grain;
float wash;
float hash(vec2 point) { return fract(sin(dot(point,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 point) {
  vec2 cell=floor(point),part=fract(point); part=part*part*(3.0-2.0*part);
  return mix(mix(hash(cell),hash(cell+vec2(1,0)),part.x),mix(hash(cell+vec2(0,1)),hash(cell+vec2(1)),part.x),part.y);
}
mat2 rotate(float angle) { return mat2(cos(angle),-sin(angle),sin(angle),cos(angle)); }
float cover(float distance) { float edge=max(fwidth(distance)*.7,.0001); return 1.0-smoothstep(-edge,edge,distance); }
float box(vec2 point,vec2 size) { vec2 edge=abs(point)-size; return length(max(edge,0.0))+min(max(edge.x,edge.y),0.0); }
float triangle(vec2 point,float radius) {
  const float root=1.7320508;
  point.x=abs(point.x)-radius;point.y+=radius/root;
  if(point.x+root*point.y>0.0) point=vec2(point.x-root*point.y,-root*point.x-point.y)*.5;
  point.x-=clamp(point.x,-2.0*radius,0.0);
  return -length(point)*sign(point.y);
}
vec3 pigment(vec3 ink) { return ink*(.94+.095*wash)+vec3(grain*.027); }
vec3 paint(vec3 base,float distance,vec3 ink) {
  float rim=exp(-abs(distance)*150.0)*.065;
  return mix(base,pigment(ink)*(1.0-rim),cover(distance));
}
vec3 palette(float index,vec3 ivory,vec3 gold,vec3 red,vec3 teal,vec3 ink) {
  float slot=mod(index,5.0);
  return slot<1.0?gold:slot<2.0?ink:slot<3.0?ivory:slot<4.0?red:teal;
}
float portalSize(float layer,float phase,float middle) {
  return 1.14-layer*.064+.015*sin(phase+layer)*middle;
}
void main() {
  vec2 outer=(vUv-.5)*vec2(16.0/9.0,1.0);
  vec3 paper=vec3(.981,.977,.963)+(hash(gl_FragCoord.xy)-.5)*.009;
  float panel=cover(box(outer,vec2(.668,.402)));
  if(panel<.001) { gl_FragColor=vec4(paper,1);return; }
  vec2 point=outer/.402;
  grain=hash(floor(point*1400.0))-.5;
  wash=noise(point*9.0)*.65+noise(point*52.0)*.35;
  float time=uTime*uMotion;
  float progress=time/max(uDuration,1.0);
  float closing=smoothstep(.94,.99,progress);
  float live=(1.0-closing)*uMotion;
  float bass=uSound.x*live,middle=uSound.y*live,treble=uSound.z*live,pulse=uPulse*live;
  float opening=smoothstep(.18,.35,progress)*(1.0-closing);
  float unfold=smoothstep(.42,.58,progress)*(1.0-closing);
  float convergence=smoothstep(.67,.81,progress)*(1.0-closing);
  float phase=time*.10;
  if(closing>0.0) phase=(atan(sin(uDuration*.094),cos(uDuration*.094))+(time-uDuration*.94)*.10)*(1.0-closing);
  vec3 ink=vec3(.065,.09,.13),ivory=vec3(.94,.91,.78);
  vec3 red=mix(vec3(.73,.16,.115),vec3(.88,.23,.15),convergence);
  vec3 gold=vec3(.96,.69,.17),teal=mix(vec3(.10,.46,.43),vec3(.16,.58,.53),unfold);
  vec3 lapis=mix(vec3(.075,.16,.32),vec3(.10,.23,.34),opening);
  vec3 background=mix(vec3(.43,.105,.12),vec3(.065,.28,.30),convergence);
  vec3 colour=pigment(background);
  float gate=box(point,vec2(1.52,.91));
  colour=paint(colour,gate,ink);
  colour=paint(colour,box(point,vec2(1.49,.88)),gold*.77);
  colour=paint(colour,box(point,vec2(1.475,.865)),lapis);
  float portalStretch=1.14;
  for(int index=0;index<7;index++) {
    float layer=float(index);
    vec2 portal=rotate(.785398)*vec2(point.x/portalStretch,point.y-.12);
    float size=portalSize(layer,phase,middle);
    float distance=abs(box(portal,vec2(size)))-.005;
    colour=mix(colour,pigment(mix(teal,gold,layer/8.0)),cover(distance)*.48);
  }
  for(int sideIndex=0;sideIndex<2;sideIndex++) {
    float side=sideIndex==0?-1.0:1.0;
    vec2 local=vec2(point.x*side,point.y);
    for(int stepIndex=0;stepIndex<9;stepIndex++) {
      float level=float(stepIndex);
      float height=-.73+level*.096;
      float offset=.91-level*.043+.045*sin(phase*.9+level*.55)*middle;
      vec2 centre=vec2(offset+level*.038*unfold,height+level*.018*opening);
      vec2 shape=rotate(-.14*unfold)*(local-centre);
      colour=paint(colour,box(shape,vec2(.35-level*.016,.042)),palette(level+3.0,ivory,gold,red,teal,ink));
    }
    for(int mark=0;mark<5;mark++) {
      float level=float(mark);
      float reach=portalSize(level,phase,middle)*1.41421356;
      vec2 centre=vec2(reach*.80*portalStretch,.12+reach*.20);
      vec2 shape=rotate(.785398)*((local-centre)/vec2(portalStretch,1.0));
      colour=paint(colour,box(shape,vec2(.016+.004*pulse)),mix(teal,gold,level/8.0));
    }
  }
  vec2 centre=vec2(0,mix(.30,.09,unfold));
  vec2 radial=point-centre;
  float radius=length(radial),angle=atan(radial.y,radial.x);
  float disc=.43+.12*opening+.10*unfold+.05*bass;
  colour=paint(colour,radius-disc-.046,ink);
  colour=paint(colour,radius-disc-.031,gold);
  colour=paint(colour,radius-disc-.020,red);
  for(int ring=0;ring<10;ring++) {
    float layer=float(ring);
    float scallop=cos(angle*12.0+phase*(mod(layer,2.0)<.5?1.0:-1.0))*.014*unfold*(1.0+middle);
    float ringRadius=disc-layer*(disc-.05)/10.0+scallop;
    vec3 base=palette(layer+2.0,ivory,gold,red,teal,ink);
    colour=paint(colour,radius-ringRadius,base);
  }
  for(int ray=0;ray<24;ray++) {
    float order=float(ray),turn=order*6.2831853/24.0;
    float drift=.09*sin(phase+order*.25)*unfold;
    vec2 local=rotate(turn+drift)*radial;
    float rayLength=.045+.075*opening+.045*treble;
    float stroke=box(local-vec2(0,disc+.11+rayLength*.5),vec2(.0035,rayLength*.5));
    colour=paint(colour,stroke,mod(order,3.0)<.5?red:gold);
  }
  float apex=.58+.07*bass+.10*opening;
  float baseLine=-.70;
  float tierHeight=.105;
  float tier=floor((apex-point.y)/tierHeight);
  float boundary=(tier+.5)*tierHeight*.70;
  float stair=max(abs(point.x)-boundary,max(point.y-apex,baseLine-point.y));
  float verticalFade=1.0-smoothstep(0.0,.9,unfold);
  vec3 pyramid=point.x<0.0?mix(gold,red,.27):mix(red,ink,.16);
  float stepMark=abs(fract((apex-point.y)/tierHeight)-.04);
  pyramid*=.86+.14*smoothstep(0.0,.13,stepMark);
  colour=mix(colour,paint(colour,stair,pyramid),verticalFade);
  colour=mix(colour,paint(colour,max(stair,abs(point.x)-.004),ivory),verticalFade*.8);
  vec2 focal=point-vec2(0,mix(-.15,.07,unfold));
  float spread=.51+.07*bass+.13*unfold;
  for(int layerIndex=0;layerIndex<6;layerIndex++) {
    float layer=float(layerIndex);
    float polarity=mod(layer,2.0)<.5?1.0:-1.0;
    float rotation=unfold*(.15*sin(phase*.7)+convergence*polarity*.30*sin(phase));
    vec2 local=rotate(rotation)*focal;
    local.y*=polarity;
    local.y+=mix(.12,.01,unfold)+layer*.006*middle;
    float size=spread-layer*.066;
    colour=paint(colour,triangle(local,size),palette(layer+1.0,ivory,gold,red,teal,ink));
  }
  vec2 seed=point-vec2(0,mix(-.12,.07,unfold));
  colour=paint(colour,length(seed)-(.043+.012*bass),gold);
  colour=paint(colour,length(seed)-.025,ink);
  colour=paint(colour,length(seed)-.010,ivory);
  for(int baseIndex=0;baseIndex<4;baseIndex++) {
    float layer=float(baseIndex);
    float width=.93-layer*.12+.04*opening;
    vec2 position=point-vec2(0,-.77+layer*.047);
    colour=paint(colour,box(position,vec2(width,.012)),palette(layer,ivory,gold,red,teal,ink));
  }
  colour*=1.0-.08*clamp(length(point*vec2(.35,.5)),0.0,1.0);
  gl_FragColor=vec4(mix(paper,colour,panel),1.0);
}