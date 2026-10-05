// Small depth-buffer renderer for touchable teaching models when WebGL is unavailable.
// It renders the same Three.js geometry, without textures, shadows or GPU animation.
import {Matrix4,Matrix3,Vector3} from '../vendor/three/three.module.js';
const light=new Vector3(-.45,.80,.46).normalize(),fill=new Vector3(.7,.25,-.6).normalize();
const encode=x=>Math.round(255*Math.pow(Math.max(0,Math.min(1,x)),1/2.2));
// Clip at the near plane before dividing by W. Essential when the camera is
// inside a room: a wall/floor triangle may extend behind the viewer.
export function clipNear(points){const result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=a[2]+a[3],db=b[2]+b[3];if(da>=0)result.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);result.push(a.map((v,k)=>v+(b[k]-v)*t));}}return result;}
export function renderPixels(scene,camera,width,height){
 const pixels=new Uint8ClampedArray(width*height*4),depth=new Float32Array(width*height);depth.fill(Infinity);
 if(scene.background?.isColor){const c=scene.background,r=encode(c.r),g=encode(c.g),b=encode(c.b);for(let k=0;k<pixels.length;k+=4){pixels[k]=r;pixels[k+1]=g;pixels[k+2]=b;pixels[k+3]=255;}}
 scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const projection=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),matrix=new Matrix4(),normals=new Matrix3(),normal=new Vector3();
 scene.traverseVisible(mesh=>{if(!mesh.isMesh||Array.isArray(mesh.material)||!mesh.material?.visible||mesh.material.opacity<.1)return;const geometry=mesh.geometry,position=geometry.attributes.position,ns=geometry.attributes.normal,index=geometry.index?.array;if(!position)return;matrix.multiplyMatrices(projection,mesh.matrixWorld);normals.getNormalMatrix(mesh.matrixWorld);const me=matrix.elements,ne=normals.elements,pa=position.array,na=ns?.array,vertices=new Float32Array(position.count*4);
  for(let v=0;v<position.count;v++){const j=v*3,k=v*4,x=pa[j],y=pa[j+1],z=pa[j+2];vertices[k]=me[0]*x+me[4]*y+me[8]*z+me[12];vertices[k+1]=me[1]*x+me[5]*y+me[9]*z+me[13];vertices[k+2]=me[2]*x+me[6]*y+me[10]*z+me[14];vertices[k+3]=me[3]*x+me[7]*y+me[11]*z+me[15];}
  const count=index?index.length:position.count,color=mesh.material.color||{r:.5,g:.5,b:.5};
  for(let face=0;face<count;face+=3){const ia=index?index[face]:face,ib=index?index[face+1]:face+1,ic=index?index[face+2]:face+2,a=ia*3,b=ib*3,c=ic*3,points=clipNear([ia,ib,ic].map(v=>Array.from(vertices.subarray(v*4,v*4+4))));if(points.length<3)continue;const projected=points.map(p=>[(p[0]/p[3]*.5+.5)*width,(.5-p[1]/p[3]*.5)*height,p[2]/p[3]]);
   for(let t=1;t<projected.length-1;t++){const [x0,y0,z0]=projected[0],[x1,y1,z1]=projected[t],[x2,y2,z2]=projected[t+1],area=(x1-x0)*(y2-y0)-(y1-y0)*(x2-x0);if(area>=-.001&&mesh.material.side!==2)continue;if(Math.abs(area)<.001)continue;
   const minX=Math.max(0,Math.floor(Math.min(x0,x1,x2))),maxX=Math.min(width-1,Math.ceil(Math.max(x0,x1,x2))),minY=Math.max(0,Math.floor(Math.min(y0,y1,y2))),maxY=Math.min(height-1,Math.ceil(Math.max(y0,y1,y2)));if(minX>maxX||minY>maxY)continue;
   if(na){const nx=(na[a]+na[b]+na[c])/3,ny=(na[a+1]+na[b+1]+na[c+1])/3,nz=(na[a+2]+na[b+2]+na[c+2])/3;normal.set(ne[0]*nx+ne[3]*ny+ne[6]*nz,ne[1]*nx+ne[4]*ny+ne[7]*nz,ne[2]*nx+ne[5]*ny+ne[8]*nz).normalize();}else normal.set(0,1,0);
   const shade=.42+Math.max(0,normal.dot(light))*.60+Math.max(0,normal.dot(fill))*.16,r=encode(color.r*shade),g=encode(color.g*shade),blue=encode(color.b*shade),inv=1/area;
   for(let y=minY;y<=maxY;y++){const py=y+.5;for(let x=minX;x<=maxX;x++){const px=x+.5,w0=((x1-px)*(y2-py)-(y1-py)*(x2-px))*inv,w1=((x2-px)*(y0-py)-(y2-py)*(x0-px))*inv,w2=1-w0-w1;if(w0<-.0001||w1<-.0001||w2<-.0001)continue;const z=w0*z0+w1*z1+w2*z2;if(z< -1||z>1)continue;const i=y*width+x;if(z>=depth[i])continue;depth[i]=z;const p=i*4;pixels[p]=r;pixels[p+1]=g;pixels[p+2]=blue;pixels[p+3]=255;}}
  }}
 });return pixels;
}
export class SoftwareRenderer{
 constructor(){this.domElement=document.createElement('canvas');this.context=this.domElement.getContext('2d');if(!this.context)throw Error('No graphics context');this.width=400;this.height=300;}
 setPixelRatio(){}setClearColor(){}
 setSize(w,h){const scale=Math.min(1.2,480/Math.max(w,h));this.width=Math.max(1,Math.round(w*scale));this.height=Math.max(1,Math.round(h*scale));this.domElement.width=this.width;this.domElement.height=this.height;}
 render(scene,camera){const image=this.context.createImageData(this.width,this.height);image.data.set(renderPixels(scene,camera,this.width,this.height));this.context.putImageData(image,0,0);}
 dispose(){}
}
