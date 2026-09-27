import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { HeaderComponent } from './components/header/header';
import { ModuleDesignerComponent } from './components/module-designer/module-designer';
import { PartsListComponent } from './components/parts-list/parts-list';
import { CutOptimizerViewComponent } from './components/cut-optimizer-view/cut-optimizer-view';
import { BudgetViewComponent } from './components/budget-view/budget-view';
import { LabelsViewComponent } from './components/labels-view/labels-view';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    HeaderComponent,
    ModuleDesignerComponent,
    PartsListComponent,
    CutOptimizerViewComponent,
    BudgetViewComponent,
    LabelsViewComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  activeTab = signal<'modules' | 'parts' | 'optimizer' | 'budget' | 'labels'>('modules');

  onTabChanged(tab: 'modules' | 'parts' | 'optimizer' | 'budget' | 'labels') {
    this.activeTab.set(tab);
  }
}
