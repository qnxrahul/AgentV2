import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JsonEditorBuildingBlockComponent } from './json-editor-building-block.component';

describe('JsonEditorBuildingBlockComponent', () => {
  let component: JsonEditorBuildingBlockComponent;
  let fixture: ComponentFixture<JsonEditorBuildingBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonEditorBuildingBlockComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(JsonEditorBuildingBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
