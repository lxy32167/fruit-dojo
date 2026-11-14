"""Render sprites from the APK's original OBJ meshes and FruitAtlas texture.
Usage: python render-fruit-assets.py EXTRACTED_REFERENCE OUTPUT_DIRECTORY
Requires Pillow. No game geometry or texture is fabricated by this renderer.
"""
import math,sys,json
from pathlib import Path
from PIL import Image,ImageDraw
src,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
variant=sys.argv[3] if len(sys.argv)>3 else ''
special=variant=='--pomegranate'
dragon=variant=='--dragonfruit'
bomb=variant=='--bomb'
atlas='Pomegranate' if special else 'BombRedCross' if bomb else 'FruitAtlas'
texture=Image.open(src/(atlas+'.png')).convert('RGBA');pixels=texture.load();tw,th=texture.size
SIZE=320
names={'watermelon':'Watermelon','orange':'Orange','apple':'AppleRed','kiwi':'Kiwifruit','lemon':'Lemon','peach':'Peach','mango':'Mango','pineapple':'Pineapple','coconut':'Coconut','strawberry':'Strawberry','greenapple':'AppleGreen','banana':'Banana','lime':'Lime','plum':'Plum','pear':'Pear','passionfruit':'Passionfruit'}
if special:names={'pomegranate':'pomegranate_'}
if dragon:names={'dragonfruit':'Dragon'}
if bomb:names={'bomb':'bomb'}
only=variant.split('=',1)[1] if variant.startswith('--only=') else None
if only:names={k:v for k,v in names.items() if k==only}
def rotate(p,ax,ay):
 x,y,z=p;y,z=y*math.cos(ax)-z*math.sin(ax),y*math.sin(ax)+z*math.cos(ax)
 return x*math.cos(ay)+z*math.sin(ay),y,-x*math.sin(ay)+z*math.cos(ay)
def read(path):
 v=[];n=[];uv=[];faces=[]
 for l in path.read_text().splitlines():
  a=l.split()
  if not a:continue
  if a[0]=='v':v.append(tuple(map(float,a[1:])))
  elif a[0]=='vn':n.append(tuple(map(float,a[1:])))
  elif a[0]=='vt':uv.append(tuple(map(float,a[1:])))
  elif a[0]=='f':faces.append([tuple(int(i)-1 for i in c.split('/')) for c in a[1:]])
 return v,n,uv,faces
records=[]
source_models={r["name"]:r for r in json.loads((src/("pomegranate-sources.json" if special else "special-model-sources.json" if dragon or bomb else "meshes/source.json")).read_text())}
for slug,name in names.items():
 for part in (['single']+[f'p_piece_{i}' for i in range(1,9)] if special else [''] if bomb else ['Whole','HalfTop','HalfBottom'] if dragon else ['Whole','Half1','Half2']):
  v,n,uv,faces=read(src/'meshes'/(name+part+'.obj'))
  ax,ay=(-.25,.65) if part in ('Whole','single','') else ((.3,-2.25) if part in ('Half1','HalfTop') else (-.3,-.9))
  v=[rotate(p,ax,ay) for p in v];n=[rotate(p,ax,ay) for p in n]
  mnx,mxx=min(p[0] for p in v),max(p[0] for p in v);mny,mxy=min(p[1] for p in v),max(p[1] for p in v)
  scale=(SIZE-20)/max(mxx-mnx,mxy-mny);cx=(mnx+mxx)/2;cy=(mny+mxy)/2
  v=[((x-cx)*scale+SIZE/2,SIZE/2-(y-cy)*scale,z) for x,y,z in v]
  image=Image.new('RGBA',(SIZE,SIZE));dest=image.load();depth=[-float('inf')]*(SIZE*SIZE)
  for face in faces:
   for index in range(1,len(face)-1):
    ids=[face[0],face[index],face[index+1]];a,b,c=[v[i[0]] for i in ids];tex=[uv[i[1]] for i in ids];norm=[n[i[2]] for i in ids]
    den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-8:continue
    for y in range(max(0,int(min(a[1],b[1],c[1]))),min(SIZE,int(max(a[1],b[1],c[1]))+1)):
     for x in range(max(0,int(min(a[0],b[0],c[0]))),min(SIZE,int(max(a[0],b[0],c[0]))+1)):
      u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den
      w=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den;t=1-u-w
      if min(u,w,t)<-.0001:continue
      z=u*a[2]+w*b[2]+t*c[2];di=y*SIZE+x
      if z<=depth[di]:continue
      tx=(u*tex[0][0]+w*tex[1][0]+t*tex[2][0])%1;ty=(u*tex[0][1]+w*tex[1][1]+t*tex[2][1])%1
      color=pixels[min(tw-1,int(tx*tw)),min(th-1,int((1-ty)*th))]
      if color[3]<10:continue
      nx,ny,nz=[u*norm[0][j]+w*norm[1][j]+t*norm[2][j] for j in range(3)];length=math.sqrt(nx*nx+ny*ny+nz*nz) or 1
      light=max(0,(-nx*.36+ny*.5+nz*.79)/length);shade=.55+.48*light
      dest[x,y]=tuple(min(255,int(ch*shade)) for ch in color[:3])+(color[3],);depth[di]=z
  filename=slug+('' if part in ('Whole','single','') else ('-half1' if part=='HalfTop' else '-half2') if dragon else '-'+part.lower())+'.webp';image.save(out/filename,quality=94)
  records.append({'file':filename,'mesh':name+part,'atlas':atlas,'rotation':[ax,ay],'unity_source':source_models[name+part],'atlas_source':{'file':('a9f822dacaa592443839c37ae5e5fc4f' if special else '10e9c911cef7265458e29b1a89995565' if bomb else '6809ed30669635b409f67e1f350c4561'),'id':1,'name':atlas}});print(filename,flush=True)
if only:
 records=[r for r in json.loads((out/'sources.json').read_text()) if not r['file'].startswith(only+'-') and r['file']!=only+'.webp']+records
(out/('pomegranate-sources.json' if special else 'dragonfruit-sources.json' if dragon else 'bomb-sources.json' if bomb else 'sources.json')).write_text(json.dumps(records,ensure_ascii=False,indent=2))
if special or dragon or bomb:
 contact=Image.new('RGB',(3*190,3*205),'#30251c');d=ImageDraw.Draw(contact)
 for i,rec in enumerate(records):
  im=Image.open(out/rec['file']);im.thumbnail((180,180));contact.paste(im,(i%3*190,i//3*205),im);d.text((i%3*190,i//3*205+183),rec['file'],fill='white')
 contact.save(src/('rendered-pomegranate.jpg' if special else 'rendered-dragonfruit.jpg' if dragon else 'rendered-bomb.jpg'));sys.exit(0)
contact=Image.new('RGB',(len(names)*170,3*190),'#30251c');d=ImageDraw.Draw(contact)
for j,part in enumerate(['','-half1','-half2']):
 for i,slug in enumerate(names):
  im=Image.open(out/(slug+part+'.webp'));im.thumbnail((160,160));contact.paste(im,(i*170+5,j*190),im);d.text((i*170+5,j*190+163),slug+part,fill='white')
contact.save(src/'rendered-fruits.jpg')
