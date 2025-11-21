import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdaptiveCardComponent } from './adaptive-card.component';

describe('AdaptiveCardComponent', () => {
  let component: AdaptiveCardComponent;
  let fixture: ComponentFixture<AdaptiveCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdaptiveCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AdaptiveCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
