import {Component, Input, Output , EventEmitter} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {ControlBaseProperty, Globals, HttpWrapper} from '@kpmgclara-aichat-lib/aichatservices';
import {BuildingBlockControlService,ConfigSettingsModel,AdaptiveCardService} from '@kpmgclara-aichat-lib/aichatservices';
import { AskResponse, AichatEventService  
 } from '@kpmgclara-aichat-lib/aichatservices';
 import {Store} from "@ngrx/store";
import {selectAllSettings} from '@kpmgclara-aichat-lib/aichatstore';
import { Subject } from 'rxjs';
 
@Component({
  selector: 'app-adaptive-card',
  templateUrl: './adaptive-card.component.html',
  styleUrl: './adaptive-card.component.css',
})
export class AdaptiveCardComponent {
  topic = new Subject<any>();
 
  @Input() adaptiveCardObject: any;
  @Input() adaptiveCardDataObject: any;
  @Input() MetaDataId: string = '';
  @Input() Keyname: string = '';
  @Input() responseobject: AskResponse =new AskResponse();
  @Input() AdaptiveAnswerMetaData:any;
  @Output() SchemaChange: EventEmitter<any> = new EventEmitter();
  panelTitle:string="";
  isPopupView: any;
  form!: FormGroup;
  payLoad = '';
  payLoadValue : any = [];
  adaptiveCardUiElements :ControlBaseProperty<string> [] = [];
  EnableExternalJs: boolean = false
  schema : any = [];
  @Output() onAdaptiveCardSubmit = new EventEmitter();
  @Output() onDownloadClickEvent = new EventEmitter<any>();
  @Output() onFlowchartDownloadClickEvent = new EventEmitter<any>();
  @Output() onDownloadAllClickEvent = new EventEmitter<any>();
  @Output() onChangeDataEvent = new EventEmitter<any>();
  DisabledFormOn : any;
  jsonFormData: any = {}
  jsonObject: Record<string, string> = {};
  settingsData!: ConfigSettingsModel;
  CommonInput: any = {};
  isLayoutbinding:boolean=false;
  metadata: any;
  isColumnTitileVisible: any;
  constructor(private adaptiveCartservice: AdaptiveCardService,private qcs: BuildingBlockControlService,private store: Store<{ settings: { entities: ConfigSettingsModel, loading: boolean, error: any } }>,
    private httpService:HttpWrapper,private globals: Globals, private aichatEventService: AichatEventService) {}
 
 
  ngOnInit() {

    // console.log("Agent ID Data Showing",this.responseobject.DataSourceId);
    // this.MetaDataId=this.responseobject.DataSourceId;
    // this.adaptiveCartservice.getMetaData(this.MetaDataId).subscribe((data: any) => {
    //   console.log("Meta data result", data);
    //   this.metadata = data;
    // });

     this.CommonInput.chatSessionObjectId = this.responseobject?.SessionId;
    if(this.AdaptiveAnswerMetaData!=undefined)
    {
      this.metadata=this.AdaptiveAnswerMetaData;
      console.log('Answer Adaptive Metadata', this.AdaptiveAnswerMetaData);
    }
    else{
      console.log('Answer Adaptive Metadata failed', this.AdaptiveAnswerMetaData);
    }
    
    this.CommonInput.baseApiUrl = this.globals.hostApi;
    if(this.responseobject.DataSourceId !=undefined && this.responseobject.DataSourceId !=null)
    {
      sessionStorage.setItem('dataSourceId', this.responseobject.DataSourceId);
    }
    if(this.responseobject.SessionId !=undefined && this.responseobject.SessionId !=null)
      {
        sessionStorage.setItem('currentSessionId', this.responseobject.SessionId);
      }
    if(this.globals.ChatSessionContext !=undefined && this.globals.ChatSessionContext !=null && this.globals.ChatSessionContext.length > 0)
    {
      var currentMessageIdContext = this.globals.ChatSessionContext.filter((item: any) => item.key === 'MessageId')
      if(currentMessageIdContext != undefined && currentMessageIdContext.length > 0)
      {
        this.CommonInput.currentMessageid = currentMessageIdContext[0].value;
      }
    }
    this.store.select(selectAllSettings).subscribe((data) => {
      if(data && Object.keys(data).length > 0)
      {
        this.settingsData=data;
      }
     
    });
    this.EnableExternalJs = this.settingsData.EnableExternalJs == undefined ? false : this.settingsData.EnableExternalJs;
    if (!this.EnableExternalJs) {
    //this.prepareBuildingBlock();
    }
   
 
  this.schema =  this.adaptiveCardObject[0];
  if(this.adaptiveCardDataObject!=undefined && this.adaptiveCardDataObject.length > 0){
    this.adaptiveCardDataObject.forEach(({ key, value }: { key: string; value: string }) => {
      this.jsonFormData[key] = value;
    });
  }
  else{
    if(this.adaptiveCardObject[0].defaultdata != undefined){
      this.jsonFormData = this.adaptiveCardObject[0].defaultdata;
    }   
  }

  const layoutData=this.adaptiveCardObject[0];
  if(layoutData.layout!=undefined && layoutData.layout!=null && Object.keys(layoutData.layout).length > 0)
  {
    console.log('layout check verified done', layoutData);
    this.isLayoutbinding=true;
    this.panelTitle = layoutData.layout.columnTitle;
    this.isPopupView = layoutData.layout.isPopupView;
    this.isColumnTitileVisible= layoutData.layout.isColumnTitleVisible;
    
  }
  else{
    console.log('layout check failed', layoutData);
  }
 
  if(this.responseobject!= undefined && this.responseobject.isAdaptiveCardSubmitted!= undefined &&
    this.responseobject.isAdaptiveCardSubmitted == true)
      {
        this.DisabledFormOn ="OnLoad";
      }
  // if(this.adaptiveCardDataObject!=undefined && this.adaptiveCardDataObject.length > 0){
  //   this.DisabledFormOn ="OnLoad";
  // }
  }
  SchemaChangeRequired(data:any){
    this.SchemaChange.emit(data);
  }
 
  onSubmit() {
    this.payLoad = this.form.getRawValue();
    Object.entries(this.payLoad).forEach(([key, value]) => {
      this.payLoadValue.push({"key" : key , "value" : value});
    });
    this.onAdaptiveCardSubmit.emit(this.payLoadValue);
  }
  prepareBuildingBlock(){
    this.adaptiveCardObject.forEach((card : any) => {
      card.UIElements.forEach((ele : any) => {
        if(this.adaptiveCardUiElements.findIndex(x=> x.ID == ele.ID) == -1){
          this.adaptiveCardUiElements.push(ele);
        }
    })
    });
   
  this.form = this.qcs.toFormGroup(this.adaptiveCardUiElements as ControlBaseProperty<string>[]);
  this.adaptiveCardUiElements.forEach((x:any) =>{
    if(x.ControlType.toLowerCase() == "dropdown" || x.ControlType.toLowerCase() == "radio" || x.ControlType.toLowerCase() == "checkbox"){
      this.form.controls[x.ID].setValue(x.Options[x.DefaultValue].ID);
    }
  })
}
getUpdatedData(event : Event){
  this.payLoadValue = [];
  console.log(event,"event")
this.payLoadValue = this.getPayLoadValue(event);
  this.onAdaptiveCardSubmit.emit(this.payLoadValue);
}
getPayLoadValue(event : Event){
  let payLoadValue : any = [];
  Object.entries(event).forEach(([key, value]) => {
    payLoadValue.push({"key" : key , "value" : value});
  });
  return payLoadValue;
}
 
getUpdatedlayoutData(event : Event){
  this.payLoadValue = [];
  console.log(event,"event")
  Object.entries(event).forEach(([key, value]) => {
    this.payLoadValue.push({"key" : key , "value" : value});
  });
  this.onAdaptiveCardSubmit.emit(this.payLoadValue);
}
commonAdaptiveCardButtonEmitter(event:any){
  let message = event.message==undefined ? '' : event.message;
  let action = event.action==undefined ? '' : event.action;
  let type = event.type==undefined ? '' : event.type;
 
  if(action.toLowerCase()=="download"){
  this.onDownloadClickEvent.emit(event);
  } else if(action.toLowerCase()=="getheaders"){
    this.handleBuildingBlockEvent(message,type);
  } 
  // else if(action.toLowerCase()=="doc-save"){
  //   this.handleBuildingBlockEvent(message,"doc-save"); 
  // } 
  // else if(action.toLowerCase()=="dataservice-load"){
  //   this.handleBuildingBlockEvent(message,"dataservice-load");
  // }
  // else if(action.toLowerCase()=="pdf-load"){
  //   this.handleBuildingBlockEvent(message,"pdf-load");
  // }
  else if(action.toLowerCase()=="flowchartdownload"){
    this.onFlowchartDownloadClickEvent.emit(this.getPayLoadValue(message));
  }
  else if(action.toLowerCase()=="downloadall"){
    this.onDownloadAllClickEvent.emit(this.getPayLoadValue(message));
  }
}
handleBuildingBlockEvent(message:any , type:any){
  this.httpService.getRequestHeaders().then(val=>{
    let response:any={};
    response.type=type;
    let data:any={};
    data['headers']=val;
    Object.assign(data, message);
    response['data']=data;
    this.topic.next(response);
 });
}


onChangeDataEmitter(event:Event)
{
  this.onChangeDataEvent.emit(event);
  const adaptivecardfileuploadEvent = event as any;
  // if (adaptivecardfileuploadEvent.uploadFiles?.type === "file-upload-building-block"){
  // this.aichatEventService.emitAdaptiveCardDataChange(adaptivecardfileuploadEvent.uploadFiles?.type);
  // }
}
// handleDocumentLoad(message:any){
//   const baseUrl = this.globals.hostApi;
//   this.httpService.getHeaders().then(val=>{
//     let response:any={};
//     response.type='doc-load-response';
//     let data:any={};
//     data['headers']=val;
//     data['baseUrl']=baseUrl;
//     Object.assign(data, message);
//     response['data']=data;
//     this.topic.next(response);
//   });
// }
}
