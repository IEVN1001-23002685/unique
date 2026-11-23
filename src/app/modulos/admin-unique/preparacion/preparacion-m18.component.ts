import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiAdminService } from '../services/api-admin.service';
import { PedidoPreparacion } from '../services/ui-admin.models'; import { AuthSessionService } from '../services/auth-session.service';
@Component({selector:'app-preparacion-m18',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./preparacion-m18.component.html',styleUrl:'./modulos-admin.css'})
export class PreparacionM18Component implements OnInit {
 private api=inject(ApiAdminService); private auth=inject(AuthSessionService); get soloLectura(){return this.auth.usuario?.rol==='ADMIN';} pedidos:PedidoPreparacion[]=[]; seleccionado:PedidoPreparacion|null=null; cargando=true; error=''; aviso=''; filtro='';
 ngOnInit(){this.cargar();}
 cargar(){this.cargando=true;this.api.get<{pedidos:PedidoPreparacion[]}>('/preparacion/cola').subscribe({next:r=>{this.pedidos=r.pedidos??[];this.cargando=false;},error:()=>{this.error='No fue posible cargar la cola de preparación. Verifica que Flask esté disponible.';this.cargando=false;}})}
 get filtrados(){return this.pedidos.filter(p=>(p.folio+' '+p.cliente).toLowerCase().includes(this.filtro.toLowerCase()));}
 tomar(p:PedidoPreparacion){this.api.post<{preparacion:PedidoPreparacion}>(`/preparacion/${p.id}/tomar`,{}).subscribe({next:r=>{this.seleccionado=r.preparacion;this.aviso='Pedido tomado. La preparación está en proceso.';this.cargar();},error:e=>this.error=e.error?.mensaje??'No se pudo tomar el pedido.'});}
 abrir(p:PedidoPreparacion){this.seleccionado=p;this.aviso='';}
 verificar(linea:any,campo:string,valor:boolean){this.api.patch(`/preparacion/${this.seleccionado?.id}/lineas/${linea.id}/verificacion`,{campo,verificado:valor}).subscribe({error:()=>{linea[campo]=!valor;this.error='No se pudo guardar la verificación.';}})}
 marcarSurtida(l:any){const cantidad=Number(l.cantidad_surtida);if(!Number.isInteger(cantidad)||cantidad<0||cantidad>l.cantidad_requerida){this.error='La cantidad surtida debe ser un entero entre 0 y la cantidad requerida.';return;}this.api.patch(`/preparacion/${this.seleccionado?.id}/lineas/${l.id}/surtido`,{cantidad_surtida:cantidad}).subscribe({error:()=>this.error='No se pudo actualizar la cantidad surtida.'});}
 get listoEmpaque(){return !!this.seleccionado?.lineas?.length&&this.seleccionado.lineas.every(l=>l.sku_verificado&&l.diseno_verificado&&l.bordado_verificado&&l.etiquetas_verificadas&&l.cantidad_surtida===l.cantidad_requerida)}
 marcarListo(){if(!this.seleccionado||!this.listoEmpaque)return;this.api.post(`/preparacion/${this.seleccionado.id}/marcar-listo`,{}).subscribe({next:()=>{this.aviso='Pedido marcado como LISTO_ENVIO y enviado al módulo de Entregas.';this.seleccionado=null;this.cargar();},error:e=>this.error=e.error?.mensaje??'No se pudo finalizar la preparación.'});}
 imprimirEtiqueta(){if(!this.seleccionado)return;this.api.getBlob(`/preparacion/${this.seleccionado.id}/etiqueta`).subscribe({next:b=>{const u=URL.createObjectURL(b);window.open(u,'_blank');},error:()=>this.error='No se pudo generar la etiqueta.'});}
 registrarIncidencia(){if(!this.seleccionado)return;const descripcion=prompt('Describe la diferencia de SKU, cantidad o calidad:');if(!descripcion?.trim())return;this.api.post(`/preparacion/${this.seleccionado.id}/incidencias`,{descripcion}).subscribe({next:()=>this.aviso='Incidencia registrada.',error:()=>this.error='No se pudo registrar la incidencia.'});}
}
