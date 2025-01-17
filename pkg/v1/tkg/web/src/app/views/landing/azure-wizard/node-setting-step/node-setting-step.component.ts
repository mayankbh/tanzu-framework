/**
 * Angular Modules
 */
import { Component, OnInit } from '@angular/core';
import { Validators } from '@angular/forms';
import { takeUntil } from 'rxjs/operators';

/**
 * App imports
 */
import { StepFormDirective } from '../../wizard/shared/step-form/step-form';
import { ValidationService } from '../../wizard/shared/validation/validation.service';
import { TkgEventType } from '../../../../shared/service/Messenger';
import { AzureWizardFormService } from 'src/app/shared/service/azure-wizard-form.service';
import { AzureInstanceType } from 'src/app/swagger/models';
import { AppEdition } from 'src/app/shared/constants/branding.constants';
import { FieldMapUtilities } from '../../wizard/shared/field-mapping/FieldMapUtilities';
import { AzureNodeSettingStandaloneStepMapping, AzureNodeSettingStepMapping } from './node-setting-step.fieldmapping';
import Broker from '../../../../shared/service/broker';
import { AzureForm } from '../azure-wizard.constants';
import { FormUtils } from '../../wizard/shared/utils/form-utils';
import { StepMapping } from '../../wizard/shared/field-mapping/FieldMapping';

@Component({
    selector: 'app-node-setting-step',
    templateUrl: './node-setting-step.component.html',
    styleUrls: ['./node-setting-step.component.scss']
})
export class NodeSettingStepComponent extends StepFormDirective implements OnInit {

    nodeTypes: AzureInstanceType[] = [];
    nodeType: string;
    currentRegion = "US-WEST";
    displayForm = false;

    constructor(private validationService: ValidationService,
                private azureWizardFormService: AzureWizardFormService,
                private fieldMapUtilities: FieldMapUtilities) {
        super();
        this.nodeTypes = [];
    }

    private supplyStepMapping(): StepMapping {
        const fieldMappings = this.modeClusterStandalone ? AzureNodeSettingStandaloneStepMapping : AzureNodeSettingStepMapping;
        FieldMapUtilities.getFieldMapping('managementClusterName', fieldMappings).required =
            Broker.appDataService.isClusterNameRequired();
        return fieldMappings;
    }

    private customizeForm() {
        this.azureWizardFormService.getErrorStream(TkgEventType.AZURE_GET_INSTANCE_TYPES)
            .pipe(takeUntil(this.unsubscribe))
            .subscribe(error => {
                this.errorNotification = error;
            });

        this.azureWizardFormService.getDataStream(TkgEventType.AZURE_GET_INSTANCE_TYPES)
            .pipe(takeUntil(this.unsubscribe))
            .subscribe((instanceTypes: AzureInstanceType[]) => {
                this.nodeTypes = instanceTypes.sort();
                if (!this.modeClusterStandalone && this.nodeTypes.length === 1) {
                    this.formGroup.get('workerNodeInstanceType').setValue(this.nodeTypes[0].name);
                }
            });
    }

    toggleValidations() {
        setTimeout(_ => {
            this.displayForm = true;
            const controlPlaneSettingControl = this.formGroup.get('controlPlaneSetting');
            if (controlPlaneSettingControl) {
                controlPlaneSettingControl.valueChanges.subscribe(data => {
                    if (data === 'dev') {
                        this.setDevCardValidations();
                    } else if (data === 'prod') {
                        this.setProdCardValidations();
                    }
                });
            } else {
                console.log('WARNING: azure-wizard.node-setting-step.toggleValidations() unable to find controlPlaneSettingControl!');
            }
        });
    }

    setDevCardValidations() {
        this.nodeType = 'dev';
        this.formGroup.markAsPending();
        this.resurrectField(
            'devInstanceType',
            [Validators.required],
            this.nodeTypes.length === 1 ? this.nodeTypes[0].name : '',
            { onlySelf: true, emitEvent: false }
        );
        this.disarmField('prodInstanceType', true);
    }

    setProdCardValidations() {
        this.nodeType = 'prod';
        this.disarmField('devInstanceType', true);
        this.formGroup.markAsPending();
        this.resurrectField(
            'prodInstanceType',
            [Validators.required],
            this.nodeTypes.length === 1 ? this.nodeTypes[0].name : '',
            { onlySelf: true, emitEvent: false }
        );
    }

    ngOnInit() {
        super.ngOnInit();
        this.fieldMapUtilities.buildForm(this.formGroup, this.formName, this.supplyStepMapping());
        this.customizeForm();
        this.toggleValidations();
        this.initFormWithSavedData();
    }

    initFormWithSavedData() {
        this.cardClick(this.getSavedValue('devInstanceType', '') === '' ? 'prod' : 'dev');
        this.getSavedValue('devInstanceType', '') === '' ? this.setProdCardValidations() : this.setDevCardValidations()
        super.initFormWithSavedData();
        // because it's in its own component, the enable audit logging field does not get initialized in the above call to
        // super.initFormWithSavedData()
        setTimeout( () => {
            this.setControlWithSavedValue('enableAuditLogging', false);
        })
    }

    cardClick(envType: string) {
        this.setControlValueSafely('controlPlaneSetting', envType);
    }

    getEnvType(): string {
        return this.formGroup.controls['controlPlaneSetting'].value;
    }

    protected dynamicDescription(): string {
        const controlPlaneSetting = this.getFieldValue("controlPlaneSetting", true);
        if (controlPlaneSetting) {
            return `Control plane type: ${controlPlaneSetting}`;
        }
        return `Specifying the resources backing the ${this.clusterTypeDescriptor} cluster`;
    }
}
