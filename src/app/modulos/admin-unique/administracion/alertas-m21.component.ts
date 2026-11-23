import { Component, OnInit, inject } from '@angular/core'; import { CommonModule } from '@angular/common'; import { FormsModule } from '@angular/forms'; import { Router } from '@angular/router';
import { ApiAdminService } from '../services/api-admin.service'; import { Alerta } from '../services/ui-admin.models';
@Component({selector:'app-alertas-m21',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./alertas-m21.component.html',styleUrl:'../preparacion/modulos-admin.css'})
export class AlertasM21Component implements OnInit { private api=inject(ApiAdminService); private router=inject(Router); pestana='todas'; alertas:Alerta[]=[]; resueltas:Alerta[]=[]; reglas:any[]=[]; cargando=true; error=''; aviso=''; rol=localStorage.getItem('unique_user')?JSON.parse(localStorage.getItem('unique_user')!).rol:'OPERATIVO'; ngOnInit(){this.cargar();if(this.rol==='ADMIN')this.cargarReglas();}
 cargar(){this.cargando=true;this.api.get<{alertas:Alerta[]}>('/alertas',{vista:this.pestana}).subscribe({next:r=>{this.alertas=r.alertas??[];this.cargando=false;},error:()=>{this.error='No fue posible consultar el centro de alertas.';this.cargando=false;}})}
 cargarResueltas(){this.api.get<{alertas:Alerta[]}>('/alertas/resueltas').subscribe({next:r=>this.resueltas=r.alertas??[],error:()=>this.error='No se pudo cargar la bitácora.'});}
 cargarReglas(){this.api.get<{reglas:any[]}>('/alertas/reglas').subscribe({next:r=>this.reglas=r.reglas??[],error:()=>this.error='No se pudieron cargar las reglas.'});}
 cambiar(t:string){this.pestana=t;if(t==='resueltas')this.cargarResueltas();else if(t==='reglas')this.cargarReglas();else this.cargar();}
 get criticas(){return this.alertas.filter(a=>a.severidad==='CRITICA').length} get preventivas(){return this.alertas.filter(a=>a.severidad==='PREVENTIVA').length} get informativas(){return this.alertas.filter(a=>a.severidad==='INFORMATIVA').length}
 ejecutar(a:Alerta){if(!confirm(`¿Ejecutar la acción: ${a.accion_label}?`))return;this.api.post(`/alertas/${a.id}/accion`,{}).subscribe({next:()=>{this.aviso='Acción ejecutada. La alerta quedó atendida.';this.cargar();},error:e=>this.error=e.error?.mensaje??'No se pudo ejecutar la acción.'});}
 ver(a:Alerta){if(a.accion_ruta)this.router.navigateByUrl(a.accion_ruta);else this.aviso=a.detalle;}
}
