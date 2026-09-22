precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec4 uSound;
uniform float uPulse;
uniform float uMotion;
uniform vec2 uResolution;
float brushLevel;
float grainLevel;

float hash(vec2 point) { return fract(sin(dot(point,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 point) {
  vec2 cell=floor(point), part=fract(point); part=part*part*(3.0-2.0*part);
  return mix(mix(hash(cell),hash(cell+vec2(1,0)),part.x),mix(hash(cell+vec2(0,1)),hash(cell+vec2(1)),part.x),part.y);
}
float textureField(vec2 point) { return noise(point*7.0)*.5+noise(point*23.0)*.3+noise(point*83.0)*.2; }
mat2 rotate(float angle) { return mat2(cos(angle),-sin(angle),sin(angle),cos(angle)); }
float coverage(float distance) { return 1.0-smoothstep(-fwidth(distance)*.7,fwidth(distance)*.7,distance); }
float circle(vec2 point,float radius) { return length(point)-radius; }
float ellipse(vec2 point,vec2 size) { return (length(point/size)-1.0)*min(size.x,size.y); }
float box(vec2 point,vec2 size) { vec2 edge=abs(point)-size; return length(max(edge,0.0))+min(max(edge.x,edge.y),0.0); }
float triangle(vec2 point,float radius) {
  float root=1.7320508;
  point.x=abs(point.x)-radius; point.y+=radius/root;
  if(point.x+root*point.y>0.0) point=vec2(point.x-root*point.y,-root*point.x-point.y)*.5;
  point.x-=clamp(point.x,-2.0*radius,0.0);
  return -length(point)*sign(point.y);
}
float almond(vec2 point,float radius,float width) {
  return max(length(point-vec2(width,0)),length(point+vec2(width,0)))-radius;
}
vec3 pigment(vec3 base,vec2 point) {
  return base*brushLevel+vec3(grainLevel);
}
vec3 paint(vec3 base,float distance,vec3 colour,vec2 point,float relief) {
  float inside=coverage(distance);
  float edge=exp(-abs(distance)*100.0);
  vec3 painted=pigment(colour,point)*(1.0-edge*.20*relief);
  return mix(base,painted,inside);
}
vec3 bandColour(float index,vec3 cream,vec3 dark,vec3 red,vec3 gold,vec3 teal) {
  float slot=mod(index,5.0);
  return slot<1.0?cream:slot<2.0?red:slot<3.0?gold:slot<4.0?dark:teal;
}
void main() {
  vec2 outer=(vUv-.5)*vec2(16.0/9.0,1.0);
  vec3 paper=vec3(.981,.977,.963)+(hash(gl_FragCoord.xy)-.5)*.009;
  vec2 artworkSize=vec2(.668,.402);
  float panel=coverage(box(outer,artworkSize));
  if(panel<.001) { gl_FragColor=vec4(paper,1); return; }
  vec2 point=outer/.402;
  brushLevel=.91+.16*textureField(point);
  grainLevel=(hash(floor(point*1250.0))-.5)*.038;
  float time=uTime*uMotion;
  float closing=smoothstep(126.0,147.0,time);
  float presence=1.0-closing;
  float bass=uSound.x*uMotion*presence, middle=uSound.y*uMotion*presence, treble=uSound.z*uMotion*presence, energy=uSound.w*uMotion*presence;
  float pulse=uPulse*uMotion*presence;
  float chapter=smoothstep(35.0,65.0,time)*presence;
  float flowering=smoothstep(64.0,85.0,time)*presence;
  float culmination=smoothstep(99.0,126.0,time)*presence;
  vec3 blue=mix(mix(vec3(.13,.23,.45),vec3(.10,.33,.38),flowering),vec3(.19,.16,.32),culmination);
  vec3 dark=vec3(.075,.12,.14);
  vec3 cream=vec3(.91,.90,.79);
  vec3 gold=mix(vec3(.91,.64,.22),vec3(.90,.77,.24),chapter);
  vec3 red=mix(vec3(.75,.21,.13),vec3(.90,.34,.17),culmination);
  vec3 teal=mix(vec3(.27,.53,.44),vec3(.34,.66,.60),chapter);
  vec3 colour=pigment(blue,point);
  float horizon=-.58+.025*sin(time*.4)*middle;
  colour=mix(colour,pigment(mix(teal,dark,.45),point),1.0-smoothstep(horizon-.002,horizon+.002,point.y));
  for(int line=0;line<5;line++) {
    float level=float(line);
    float height=-.66-level*.061;
    float wave=sin(point.x*(3.0+level*.35)+time*.18+level)*.012*middle;
    colour=paint(colour,abs(point.y-height-wave)-.019,mod(level,2.0)<.5?gold:dark,point,.4);
  }
  for(int sideIndex=0;sideIndex<2;sideIndex++) {
    float side=sideIndex==0?-1.0:1.0;
    vec2 mirrored=vec2(point.x*side,point.y);
    for(int row=0;row<3;row++) {
      for(int petal=0;petal<5;petal++) {
        float order=float(petal), height=float(row);
        float outward=.30+order*.23+height*.105;
        vec2 centre=vec2(outward,-.34+height*.46+sin(order*.70+height*.4)*.15);
        float fanAngle=-1.10+order*.48+height*.16+sin(time*.14)*.17;
        vec2 radial=vec2(cos(fanAngle)*(.60+height*.26),sin(fanAngle)*(.60+height*.20)) + vec2(.10,.06);
        centre=mix(centre,radial,flowering);
        centre+=vec2(.075*sin(time*.73+order*.65)*bass,.07*sin(time*.51+order*.65+height)*middle);
        float tilt=mix(.38+order*.14,1.5708-fanAngle,flowering)+.20*sin(time*.39+height)*energy;
        vec2 local=rotate(tilt)*(mirrored-centre);
        vec2 size=vec2(.145+.032*bass,.24+.080*middle+.04*culmination);
        float distance=ellipse(local,size);
        colour=mix(colour,dark,exp(-max(distance,0.0)*65.0)*.26);
        vec3 petalColour=mix(cream,teal,clamp(height*.19+order*.045,0.0,.7));
        petalColour=mix(petalColour,mix(red,gold,height/3.0),culmination*.42);
        float lighting=.70+.25*clamp(1.0-length(local/size)*.6-local.x*.8+local.y*.5,0.0,1.0);
        colour=paint(colour,distance,petalColour*lighting,point,1.0);
        colour=paint(colour,abs(ellipse(local+vec2(.012,0),size*.91))-.0018,cream*.82,point,.0);
      }
    }
  }
  vec2 core=point-vec2(0,mix(.17,.02,flowering));
  core=rotate(.045*sin(time*.21)*middle+flowering*sin(time*.18)*.22)*core;
  float breathing=1.0+.18*bass+.04*sin(time*.55)*energy;
  vec2 lens=core/breathing;
  float opening=.06*sin(time*.29)*middle;
  for(int ring=0;ring<8;ring++) {
    float layer=float(ring);
    float radius=.80-layer*.067;
    float width=.39-layer*.023+opening;
    vec3 ink=mix(bandColour(layer,cream,dark,red,gold,teal),bandColour(layer+2.0,cream,dark,red,gold,teal),chapter);
    float polar=atan(lens.y,lens.x);
    float lobes=cos(polar*8.0+time*.30+layer*.23)*(.023+.016*middle);
    float radialDistance=length(lens)-(radius*.74+lobes);
    float distance=mix(almond(lens,radius,width),radialDistance,flowering);
    colour=paint(colour,distance,ink,point,.7);
  }
  float aperture=.079+.028*bass+.010*pulse;
  colour=paint(colour,circle(core,aperture+.024),gold,point,.6);
  colour=paint(colour,circle(core,aperture),dark,point,.2);
  colour=paint(colour,circle(core-vec2(0,.008),aperture*.37),cream,point,.0);
  for(int orbit=0;orbit<4;orbit++) {
    float layer=float(orbit);
    float orbitAngle=time*.055;
    if(closing>0.0) {
      float restAngle=atan(sin(126.0*.055),cos(126.0*.055));
      orbitAngle=(restAngle+(time-126.0)*.055)*presence;
    }
    vec2 ringPoint=rotate(orbitAngle*(mod(layer,2.0)<.5?1.0:-1.0))*core;
    float ring=ellipse(ringPoint,vec2(.50+layer*.14+.025*bass,.73+layer*.065));
    float segmentAngle=time*.13;
    if(closing>0.0) segmentAngle=(atan(sin(126.0*.13),cos(126.0*.13))+(time-126.0)*.13)*presence;
    float segments=.5+.5*cos(atan(ringPoint.y,ringPoint.x)*8.0+segmentAngle);
    colour=mix(colour,pigment(mix(gold,cream,layer/4.0),point),coverage(abs(ring)-.0024)*(.18+.35*segments));
  }
  vec2 base=point-vec2(0,mix(-.48,-.04,culmination));
  float turn=.13*sin(time*.3)*chapter+.13*pulse+culmination*(time-99.0)*.085;
  for(int tier=0;tier<7;tier++) {
    float layer=float(tier);
    vec2 local=rotate((mod(layer,2.0)<.5?1.0:-1.0)*turn)*base;
    if(mod(layer,2.0)<.5) local.y=-local.y;
    local.y+=.035*sin(time*.3+layer*.5)*bass;
    float size=.51-layer*.052+.095*middle+.10*culmination;
    vec3 ink=bandColour(layer+2.0,cream,dark,red,gold,teal);
    colour=paint(colour,triangle(local,size),ink,point,.55);
  }
  for(int direction=0;direction<2;direction++) {
    float signDirection=direction==0?-1.0:1.0;
    for(int diamond=0;diamond<6;diamond++) {
      float order=float(diamond);
      vec2 centre=vec2(signDirection*(.73+order*.135),-.54+sin(order*.65)*.085);
      centre.y+=sin(time*.65+order*.8)*.035*treble;
      vec2 local=rotate(.785398+signDirection*.08*sin(time*.3)*energy)*(point-centre);
      colour=paint(colour,box(local,vec2(.050+.012*pulse)),mod(order,2.0)<.5?gold:cream,point,.65);
    }
  }
  float upper=abs(point.y-(.84+.026*middle*sin(time*.4)))-.003;
  colour=paint(colour,max(upper,abs(point.x)-1.12),cream*.8,point,.1);
  float shade=clamp(length(point*vec2(.37,.48)),0.0,1.0);
  colour*=1.0-.15*shade;
  colour+=(textureField(point*2.0)-.5)*.026;
  float innerEdge=box(outer,artworkSize);
  colour*=1.0-exp(-abs(innerEdge)*650.0)*.22;
  gl_FragColor=vec4(mix(paper,colour,panel),1.0);
}