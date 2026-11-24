import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; import { FormsModule, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ApiAdminService } from '../services/api-admin.service'; import { Entrega, Repartidor } from '../services/ui-admin.models';
@Component({selector:'app-entregas-m19',standalone:true,imports:[CommonModule,FormsModule,ReactiveFormsModule],templateUrl:'./entregas-m19.component.html',styleUrl:'./modulos-admin.css'})
export class EntregasM19Component implements OnInit {
 private api=inject(ApiAdminService); private fb=inject(FormBuilder); pestana='asignar'; entregas:Entrega[]=[]; repartidores:Repartidor[]=[]; cargando=true; error=''; aviso=''; filtro=''; editando:number|null=null;
 form=this.fb.group({nombre:['',[Validators.required,Validators.maxLength(100)]],telefono:['',[Validators.required,Validators.pattern(/^\d{10}$/)]],vehiculo:['',[Validators.required,Validators.maxLength(60)]]});
 ngOnInit(){this.cargar();this.cargarRepartidores();}
 cargar(){this.cargando=true;this.api.get<{entregas:Entrega[]}>('/entregas',{vista:this.pestana}).subscribe({next:r=>{this.entregas=r.entregas??[];this.cargando=false;},error:()=>{this.error='No fue posible cargar las entregas. Comprueba la API.';this.cargando=false;}})}
 cargarRepartidores(){this.api.get<{repartidores:Repartidor[]}>('/entregas/repartidores').subscribe({next:r=>this.repartidores=r.repartidores??[],error:()=>this.error='No se pudo cargar el catálogo de repartidores.'});}
 cambiarTab(t:string){this.pestana=t;this.cargar();}
 asignar(e:Entrega){const repartidor=Number(prompt('Escribe el ID del repartidor disponible:'));if(!repartidor)return;const fecha=prompt('Fecha programada (AAAA-MM-DD):');if(!fecha)return;this.api.post(`/entregas/${e.id}/asignar`,{repartidor_id:repartidor,fecha_programada:fecha}).subscribe({next:()=>{this.aviso='Entrega asignada correctamente.';this.cargar();},error:x=>this.error=x.error?.mensaje??'No se pudo asignar.'});}
 salida(e:Entrega){if(!confirm(`¿Confirmar salida de ${e.folio}? La existencia se descontará desde el servidor.`))return;this.api.post(`/entregas/${e.id}/salida`,{}).subscribe({next:()=>{this.aviso='Salida confirmada.';this.cargar();},error:x=>this.error=x.error?.mensaje??'No se pudo confirmar la salida.'});}
 resultado(e:Entrega,estado:'ENTREGADO'|'FALLIDA'){let receptor='';let motivo='';if(estado==='ENTREGADO'){receptor=prompt('Nombre de quien recibe:')??'';if(!receptor.trim())return;}else{motivo=prompt('Motivo: ausente, dirección incorrecta, rechazado u otro')??'';if(!motivo.trim())return;}this.api.post(`/entregas/${e.id}/resultado`,{estado,receptor,motivo}).subscribe({next:()=>{this.aviso=estado==='ENTREGADO'?'Entrega registrada.':'Incidencia de entrega registrada.';this.cargar();},error:x=>this.error=x.error?.mensaje??'No se pudo registrar el resultado.'});}
 guardarRepartidor(){if(this.form.invalid){this.form.markAllAsTouched();return;}const req=this.editando?this.api.put(`/entregas/repartidores/${this.editando}`,this.form.getRawValue()):this.api.post('/entregas/repartidores',this.form.getRawValue());req.subscribe({next:()=>{this.aviso='Repartidor guardado.';this.form.reset();this.editando=null;this.cargarRepartidores();},error:x=>this.error=x.error?.mensaje??'No se pudo guardar el repartidor.'});}
 editar(r:Repartidor){this.editando=r.id;this.form.patchValue(r);}
 desactivar(r:Repartidor){if(!confirm(`¿Desactivar a ${r.nombre}? Si tiene entregas históricas no se eliminará físicamente.`))return;this.api.delete(`/entregas/repartidores/${r.id}`).subscribe({next:()=>this.cargarRepartidores(),error:()=>this.error='No se pudo desactivar.'});}
 get repartidoresActivos(){return this.repartidores.filter(r=>r.activo).length;}
 get filtradas(){return this.entregas.filter(e=>(e.folio+' '+e.cliente+' '+e.codigo_postal).toLowerCase().includes(this.filtro.toLowerCase()));}
}
