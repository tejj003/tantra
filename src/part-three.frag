precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec4 uSound;
uniform float uPulse;
uniform float uMotion;
uniform float uDuration;

float brush;
float grain;
float hash(vec2 point) { return fract(sin(dot(point,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 point) {
  vec2 cell=floor(point),part=fract(point); part=part*part*(3.0-2.0*part);
  return mix(mix(hash(cell),hash(cell+vec2(1,0)),part.x),mix(hash(cell+vec2(0,1)),hash(cell+vec2(1)),part.x),part.y);
}
mat2 turn(float angle) { return mat2(cos(angle),-sin(angle),sin(angle),cos(angle)); }
float mask(float distance) { float edge=max(fwidth(distance)*.65,.0001); return 1.0-smoothstep(-edge,edge,distance); }
float box(vec2 point,vec2 size) { vec2 edge=abs(point)-size; return length(max(edge,0.0))+min(max(edge.x,edge.y),0.0); }
float ellipse(vec2 point,vec2 size) { return (length(point/size)-1.0)*min(size.x,size.y); }
float merge(float first,float second,float radius) {
  float blend=clamp(.5+.5*(second-first)/radius,0.0,1.0);
  return mix(second,first,blend)-radius*blend*(1.0-blend);
}
float cloud(vec2 point) {
  float shape=ellipse(point-vec2(0,-.045),vec2(.55,.12));
  shape=merge(shape,ellipse(point-vec2(-.29,.015),vec2(.16,.13)),.045);
  shape=merge(shape,ellipse(point-vec2(-.08,.12),vec2(.22,.205)),.055);
  shape=merge(shape,ellipse(point-vec2(.20,.055),vec2(.19,.16)),.045);
  shape=merge(shape,ellipse(point-vec2(.39,-.015),vec2(.16,.10)),.04);
  return shape;
}
float leaf(vec2 point,float size) { return max(length(point-vec2(size*.53,0)),length(point+vec2(size*.53,0)))-size; }
vec3 pigment(vec3 colour) { return colour*(.96+.08*brush)+vec3(grain*.020); }
vec3 paint(vec3 under,float distance,vec3 colour) {
  return mix(under,pigment(colour)*(1.0-.045*exp(-abs(distance)*100.0)),mask(distance));
}
vec3 cloudPaint(vec3 under,vec2 point,vec3 white,vec3 shadow) {
  float shape=cloud(point);
  under=paint(under,shape+.008,shadow);
  under=paint(under,cloud(point-vec2(0,.021))+.013,mix(white,shadow,.23));
  under=paint(under,cloud(point-vec2(0,.048))+.029,white);
  return under;
}
void main() {
  vec2 outer=(vUv-.5)*vec2(16.0/9.0,1.0);
  vec3 paper=vec3(.981,.977,.963)+(hash(gl_FragCoord.xy)-.5)*.009;
  float panel=mask(box(outer,vec2(.668,.402)));
  if(panel<.001) { gl_FragColor=vec4(paper,1);return; }
  vec2 point=outer/.402;
  brush=noise(point*8.0)*.65+noise(point*49.0)*.35;
  grain=hash(floor(point*1400.0))-.5;
  float time=uTime*uMotion;
  float progress=time/max(uDuration,1.0);
  float stilling=1.0-smoothstep(.84,.985,progress);
  float live=uMotion*stilling;
  float bass=smoothstep(.16,1.08,uSound.x)*live;
  float middle=smoothstep(.22,1.05,uSound.y)*live;
  float treble=smoothstep(.18,1.05,uSound.z)*live;
  float accent=clamp(uPulse,0.0,1.0)*live;
  float breath=(.5+.5*sin(time*.82))*middle;
  float swell=bass*.72+accent*.28;
  float morning=smoothstep(.15,.35,progress)*stilling;
  float bloom=smoothstep(.40,.68,progress)*stilling;
  float spacious=smoothstep(.70,.85,progress)*stilling;
  vec3 ink=vec3(.08,.23,.24),jade=vec3(.18,.43,.37),mint=vec3(.48,.68,.53);
  vec3 ivory=vec3(.965,.943,.84),rose=vec3(.78,.44,.37),coral=vec3(.88,.38,.25);
  vec3 gold=vec3(.95,.73,.34),mist=vec3(.74,.83,.77);
  vec3 sky=mix(vec3(.44,.66,.68),vec3(.62,.75,.65),morning*.7);
  sky=mix(sky,vec3(.77,.70,.61),spacious*.34);
  vec3 colour=pigment(mix(sky,mist,smoothstep(-.55,.9,point.y)*.30));

  vec2 halo=point-vec2(0,.28+.055*middle+.025*breath);
  for(int ring=0;ring<5;ring++) {
    float layer=float(ring);
    float radius=.60-layer*.038+.09*morning+.065*swell;
    float ripple=sin(atan(halo.y,halo.x)*6.0-time*.55+layer*.65)*.009*treble*bloom;
    vec2 orbit=turn(sin(time*.32+layer*.7)*.16*middle)*halo;
    float contour=abs(length(orbit*vec2(1.0-.04*breath,1.02+.065*breath))-radius-ripple)-.0024;
    colour=mix(colour,pigment(mix(ivory,gold,layer/5.0)),mask(contour)*.60);
  }
  float discRadius=.40+.035*morning+.036*swell;
  colour=paint(colour,length(halo)-discRadius-.020,ivory);
  colour=paint(colour,length(halo)-discRadius-.008,rose);
  colour=paint(colour,length(halo)-discRadius,gold);
  colour=paint(colour,length(halo-vec2(0,.07))-(discRadius-.065),mix(ivory,gold,.35));
  colour=paint(colour,length(halo-vec2(0,.07))-.033,coral);

  for(int ridge=0;ridge<4;ridge++) {
    float layer=float(ridge);
    float slope=abs(point.x)-.83-layer*.09-.045*sin(time*.38+layer*.6)*middle;
    float hill=-.18-layer*.092+.29*exp(-pow(slope/.47,2.0));
    hill+=sin(point.x*2.3+layer*.8)*.028+middle*.030*sin(time*.46+abs(point.x)*1.4+layer*.45);
    vec3 tone=mix(mist,jade,.27+layer*.18);
    colour=paint(colour,point.y-hill,tone);
    colour=paint(colour,abs(point.y-hill+.008)-.0025,mix(ivory,tone,.68));
  }

  for(int sideIndex=0;sideIndex<2;sideIndex++) {
    float side=sideIndex==0?-1.0:1.0;
    vec2 mirrored=vec2(point.x*side,point.y);
    for(int bank=0;bank<3;bank++) {
      float layer=float(bank);
      float distance=.60+layer*.32+.14*morning+.09*bloom;
      float drift=sin(time*.62+layer*.85)*(.09+.035*layer)*middle;
      float lift=sin(time*.78+layer*.85)*.045*middle+.044*swell;
      vec2 centre=vec2(distance+drift+.055*swell,.59-layer*.28+lift);
      float size=(.78+layer*.07)*(1.0+.075*swell);
      float roll=sin(time*.62+layer*.85)*.075*middle;
      vec2 local=turn(roll)*(mirrored-centre)/size;
      local.x*=1.0-layer*.065+.035*breath;
      local.y*=1.0+layer*.14-.06*swell;
      vec3 cloudWhite=mix(ivory,vec3(.87,.93,.85),layer*.13);
      colour=cloudPaint(colour,local,cloudWhite,mix(rose,mist,.75+layer*.065));
    }
  }

  float waterline=-.46+.030*sin(time*.62)*middle;
  colour=paint(colour,point.y-waterline,ink);
  for(int ripple=0;ripple<8;ripple++) {
    float layer=float(ripple);
    float height=waterline-.035-layer*.063;
    float travel=abs(point.x)*(5.0+layer*.25)-time*(1.45+layer*.055)+layer*.65;
    float wave=sin(travel)*(.015*middle+.016*treble+.012*accent);
    wave+=sin(abs(point.x)*10.0-time*2.10+layer*.9)*.006*treble;
    float bed=height+pow(abs(point.x)*.41,1.6)*.050+wave;
    vec3 tone=mod(layer,3.0)<.5?mix(mint,mist,.2):mod(layer,3.0)<1.5?jade:mix(ink,sky,.43);
    colour=paint(colour,abs(point.y-bed)-.020,tone);
    float reflectionWidth=(.12+layer*.024)*(1.0+.32*swell+.12*sin(time*.90+layer*.5)*middle);
    colour=paint(colour,max(abs(point.y-bed)-.007,abs(point.x)-reflectionWidth),mix(gold,ivory,layer/9.0));
  }

  vec2 root=vec2(0,-.45);
  for(int sideIndex=0;sideIndex<2;sideIndex++) {
    float side=sideIndex==0?-1.0:1.0;
    vec2 mirrored=vec2(point.x*side,point.y);
    for(int petal=0;petal<4;petal++) {
      float layer=float(petal);
      float flourish=sin(time*.82-layer*.45)*.12*middle;
      float angle=.24+layer*.27+bloom*.24+flourish+.11*swell;
      float length=.30-layer*.024+.035*swell+.012*breath;
      vec2 centre=root+vec2(sin(angle),cos(angle))*(.24+layer*.050+.045*swell);
      vec2 local=turn(angle)*(mirrored-centre);
      float shape=leaf(local,length);
      vec3 tone=layer<1.0?ivory:layer<2.0?mint:layer<3.0?jade:ink;
      colour=paint(colour,shape-.008,mix(gold,jade,.65));
      colour=paint(colour,shape,tone);
      colour=paint(colour,max(abs(local.x)-.0015,shape+.028),mix(ivory,tone,.58));
    }
  }
  vec2 seed=point-vec2(0,-.25+.018*morning+.018*swell);
  colour=paint(colour,leaf(seed,.24+.032*swell),rose);
  colour=paint(colour,leaf(seed,.197+.027*swell),coral);
  colour=paint(colour,leaf(seed,.137+.022*swell),gold);
  colour=paint(colour,length(seed-vec2(0,.025))-.026,ivory);

  colour*=1.0-.055*clamp(length(point*vec2(.35,.48)),0.0,1.0);
  gl_FragColor=vec4(mix(paper,colour,panel),1.0);
}