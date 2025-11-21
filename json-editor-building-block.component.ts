import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { JsonEditorOptions } from 'ang-jsoneditor';
import { BaseComponent } from '../base/base.component';
import { SyncbuildingblocksService } from '../../services/syncbuildingblocks.service';

@Component({
  selector: 'lib-json-editor-building-block',
  templateUrl: './json-editor-building-block.component.html',
  styleUrl: './json-editor-building-block.component.css'
})
export class JsonEditorBuildingBlockComponent  extends BaseComponent  implements OnInit {

  constructor(syncbuildingblocks: SyncbuildingblocksService) {
    super(syncbuildingblocks);
  }

  public editorOptions: JsonEditorOptions = new JsonEditorOptions();

  @ViewChild('accordianBody') accordianBody: ElementRef<HTMLElement> = {} as ElementRef;
  isOpen: boolean = false;
  data : any
  ngOnInit(): void {
    this.data = this.formGroup.get(this.field.name).value;
  this.editorOptions.mode = 'code';
    this.SyncForm();
  }
  onchangeJSONData(event:any,scope:string){
    if(!event.isTrusted){
      this.formGroup.get(this.field.name)?.setValue(event);
      this.OnChange.emit({"event":event,"editscope":scope});
    }
  }

  togleAccordion(){
    this.isOpen = !this.isOpen;
  }
}
