////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//                            DCL LANDSCAPES - An open library for programmed landscapes
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Master control switch for logging
let logging: boolean = true
let msgERROR: string = "DCL Landscapes - ERROR: "
let msgWARNING: string = "DCL Landscapes - WARNING: "
let msgDEBUG: string = "DCL Landscapes - DEBUG: "

// Model repository
let modelDirectory: string = "models/"
import {EntityRepository} from "./modelRepository"

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// DCL LANDSCAPES layer data
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Interface for relative positioning of one entity within a layer
interface EntityPositionInLayerItem {
    id: number
    entityId: number
    position: Vector3
    rotation: Quaternion,
    scale: Vector3
}

// Interface for element index in raw data
interface RawDataElementIndex {
    position: number
    entityId: number
    elevationInLayer: number
    rotation: number
    scale: number
}

export class Layer {
    private _rawDatapoint: RawDataElementIndex = {position: 0, entityId: 1, elevationInLayer: 2, rotation: 3, scale: 4}
    private _rawDatapointCountMinimum: number = 2 // minimum raw data be the layer cell coordinate (x,z) and model id
    private _name: string
    private _rawData: string
    private _dimension: Vector3
    private _position: Vector3
    private _pivotOffset: Vector3
    private _rotation: Quaternion
    private _cellSize: number
    private _scale: Vector3
    private _entityPositionInLayer: EntityPositionInLayerItem[]
    private _displayLabels: boolean
    private _layerEntity: Entity

    constructor(name: string, dimension: Vector3, rawData: string, position: Vector3, rotation: Quaternion, cellSize: number, scale: Vector3, labels: boolean) {
        this._name = name
        this._rawData = rawData
        this._dimension = dimension
        this._position = position
        this._rotation = rotation
        this._cellSize = cellSize
        this._scale = scale
        this._displayLabels = labels
        //this._pivotOffset = new Vector3( ((dimension.x*cellSize)/2), ((dimension.y*cellSize)/2), ((dimension.z*cellSize)/2) )
        this._pivotOffset = new Vector3( cellSize/2, 0, cellSize/2 )

        // Parse raw data into layer structure
        this._entityPositionInLayer = []
        this.parseRawData(rawData)
    }

    set name(newName: string) {
        this._name = newName
    }
    get name(): string {
        return this._name
    }

    set rawData(rawData: string) {
        this._rawData = rawData
    }
    get rawData(): string {
        return this._rawData
    }

    set position(newPosition: Vector3) {
        this._position = newPosition
    }
    get position(): Vector3 {
        return this._position
    }

    set rotation(newRotation: Quaternion) {
        this._rotation = newRotation
    }
    get rotation(): Quaternion {
        return this._rotation
    }

    set cellSize(newCellSize: number) {
        this._cellSize = newCellSize
    }
    get cellSize(): number {
        return this._cellSize
    }

    set scale(newScale: Vector3) {
        this._scale = newScale
    }
    get scale(): Vector3 {
        return this._scale
    }

    set displayLabels(newLabels: boolean) {
        this._displayLabels = newLabels
    }
    get displayLabels(): boolean {
        return this._displayLabels
    }

    set entity(newEntity: Entity) {
        this._layerEntity = newEntity
    }
    get entity(): Entity {
        return this._layerEntity
    }

    set pivotOffset(newPivotOffset: Vector3) {
        this._pivotOffset = newPivotOffset
    }
    get pivotOffset(): Vector3 {
        return this._pivotOffset
    }

    get entityArray(): EntityPositionInLayerItem[] {
        return this._entityPositionInLayer
    }

    retrieveEntity(id: number): EntityPositionInLayerItem {
        if (id >= 0 && id <= this._entityPositionInLayer.length)
            return this._entityPositionInLayer[id]
        else
            return null
    }

    updateEntity(id: number, updatedEntity: EntityPositionInLayerItem): boolean {
        if (id >= 0 && id <= this._entityPositionInLayer.length) {
            this._entityPositionInLayer[id] = updatedEntity
            return true
        } else
            return false
    }


    private parseRawData(toProcess: string) {
        let arrayId: number = 0
        let rawDataArray: string[] = toProcess.split("\n")
        for (let entry in rawDataArray) {
            // Ignore commented lines
            if ( !((rawDataArray[entry].substring(0,1)).match('#')) ) {
                let rawDataEntryArray: string[] = rawDataArray[entry].split(" ")
                if (rawDataEntryArray.length < this._rawDatapointCountMinimum) {
                    log(msgWARNING + "Entry '" + rawDataArray[entry] + "' does not contain the min. set data points " +
                        "which are layer cell coordinate (x,z) and the model id!")
                } else {
                    // Parse raw data into structure

                    ////////////////////////////////////////////////////////////////////////////////////////////////////////
                    // Position 1: relative cell coordinates (x,z)
                    //
                    // Default relative x and z position is the upper left cell (0,0) of the layer which in meter
                    // is the cell length and width divided by two and the y coordinate of the layer's position.
                    // Relative elevation y is defaulted to 0 meaning 0m to add to the elevation of the layer
                    let entityCellCoordinateInLayer: Vector3 = new Vector3((this._cellSize / 2), 0, (this._cellSize / 2))
                    if (rawDataEntryArray[this._rawDatapoint['position']].split(",").length == 2) {
                        entityCellCoordinateInLayer = new Vector3(
                            // relative x coordinate of the cell
                            parseInt(rawDataEntryArray[this._rawDatapoint['position']].split(",")[0]) * this._cellSize,
                            // relative y to layer elevation in meter is 0, may be set if elevation is present in raw data
                            0,
                            // relative z coordinate of the cell
                            parseInt(rawDataEntryArray[this._rawDatapoint['position']].split(",")[1]) * this._cellSize
                        )
                    }

                    ////////////////////////////////////////////////////////////////////////////////////////////////////////
                    // Position 2: entity reference id
                    //
                    // Entity id is the reference to the gltf model, sound or native DCL entity, defaults to a cube (id 0)
                    // of dimension 1 meter by 1 meter by 1 meter
                    let entityId: number = 0
                    if (parseInt(rawDataEntryArray[this._rawDatapoint['entityId']]) > 0) {
                        entityId = parseInt(rawDataEntryArray[this._rawDatapoint['entityId']])
                    }

                    ////////////////////////////////////////////////////////////////////////////////////////////////////////
                    // Position 3: (optional) elevation
                    //
                    // Elevation of the entity relative to the layer's elevation from ground in meters
                    if (rawDataEntryArray.length >= 3) {
                        entityCellCoordinateInLayer.y = parseFloat(rawDataEntryArray[this._rawDatapoint['elevationInLayer']])
                    }

                    // Offset for pivoting
                    if (logging) log(msgDEBUG + 'Offset ' + entityCellCoordinateInLayer + ' by ' +
                        entityCellCoordinateInLayer.subtract(this._pivotOffset))
                    entityCellCoordinateInLayer = entityCellCoordinateInLayer.subtract(this._pivotOffset)

                    ////////////////////////////////////////////////////////////////////////////////////////////////////////
                    // Position 4: (optional) rotation
                    //
                    // Check out if the raw data has 3 elements (Euler) or 4 elements (Quaternion) and do the
                    // necessary transformation from Euler to Quaternion.
                    // In case something else or no data has been provided, set rotation to (0, 0, 0, 0).
                    let entityRotation: Quaternion = new Quaternion(0, 0, 0, 0)
                    if (rawDataEntryArray.length >= 4) {
                        if ((rawDataEntryArray[this._rawDatapoint['rotation']].split(",").length == 3)) {
                            entityRotation = Quaternion.Euler(
                                parseFloat(rawDataEntryArray[this._rawDatapoint['rotation']].split(",")[0]),
                                parseFloat(rawDataEntryArray[this._rawDatapoint['rotation']].split(",")[1]),
                                parseFloat(rawDataEntryArray[this._rawDatapoint['rotation']].split(",")[2])
                            )
                        } else if ((rawDataEntryArray[this._rawDatapoint['rotation']].split(",").length == 4)) {
                            entityRotation = new Quaternion(
                                parseFloat(rawDataEntryArray[this._rawDatapoint['rotation']].split(",")[0]),
                                parseFloat(rawDataEntryArray[this._rawDatapoint['rotation']].split(",")[1]),
                                parseFloat(rawDataEntryArray[this._rawDatapoint['rotation']].split(",")[2]),
                                parseFloat(rawDataEntryArray[this._rawDatapoint['rotation']].split(",")[3])
                            )
                        }
                    }

                    ////////////////////////////////////////////////////////////////////////////////////////////////////////
                    // Position 5: (optional) scale
                    //
                    // Scale of the entity in the layer
                    let entityScale: Vector3 = new Vector3(1, 1, 1)
                    if (rawDataEntryArray.length >= 5) {
                        if ((rawDataEntryArray[this._rawDatapoint['scale']].split(",").length == 3)) {
                            entityScale = new Vector3(
                                parseFloat(rawDataEntryArray[this._rawDatapoint['scale']].split(",")[0]),
                                parseFloat(rawDataEntryArray[this._rawDatapoint['scale']].split(",")[1]),
                                parseFloat(rawDataEntryArray[this._rawDatapoint['scale']].split(",")[2])
                            )
                        }
                    }

                    // Bring it all together in the layer's entity array
                    this._entityPositionInLayer.push(
                        {
                            // Array index
                            id: arrayId,
                            // Unique id referencing the entity to place
                            entityId: entityId,
                            // Relative position of the entity in the layer's position
                            position: entityCellCoordinateInLayer,
                            // Relative rotation of the entity in in relation to the layer's absolute rotation
                            rotation: entityRotation,
                            // Relative scale
                            scale: entityScale
                        }
                    )

                    if (logging) log(msgDEBUG +
                        'Parsed data point: ' + entry + ' "' + rawDataArray[entry] + '" ' +
                        'with entity id: ' + entityCellCoordinateInLayer +
                        ', position: ' + entityCellCoordinateInLayer +
                        ', rotation Euler: ' + entityRotation.eulerAngles +
                        ', rotation Quaternion: ' + entityRotation +
                        ', scale: ' + entityScale)
                }
                // Increment array index
                arrayId++
            }
        }
    }

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// DCL LANDSCAPES layer placement
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function placeLayer(layer: Layer) {
    if (logging) log(msgDEBUG + "Placing layer '" + layer.name + "' with " + layer.entityArray.length + " entitie(s)")

    // Source library models
    let entityRepository: EntityRepository = new EntityRepository()

    // Create parent layer entity and add it to the system
    let layerParentEntity: Entity = new Entity()
    layer.entity = layerParentEntity
    engine.addEntity(layerParentEntity)

    // Position all entities of a layer
    for (let entity of layer.entityArray) {

        // Assemble entity properties
        let entityFileName: string = modelDirectory + entityRepository.modelFileName(entity.entityId)
        // let entityPosition: Vector3 = new Vector3(
        //     entity.position.x * layer.cellSize + layer.cellSize/2 ,
        //     entity.position.y,
        //     entity.position.z * layer.cellSize + layer.cellSize/2
        // )
        let entityScale: Vector3 = entity.scale
        let entityRotation: Quaternion = entity.rotation

        // Create, position, scale and rotate layer child entities
        let childEntity: Entity = new Entity()
        childEntity.setParent(layerParentEntity)
        childEntity.addComponent(new GLTFShape(entityFileName))
        childEntity.addComponent(new Transform({
            position: entity.position,
            scale: entityScale,
            rotation: entityRotation
        }))

        if (logging) log(msgDEBUG +
            'Added entity id: ' + entity.entityId +
            ', model file: ' + entityRepository.modelFileName(entity.entityId) +
            ', position: ' + entity.position +
            ', rotation Euler: ' + entityRotation.eulerAngles +
            ', rotation Quaternion: ' + entityRotation +
            ', scale: ' + entityScale
        )

        if (layer.displayLabels) {

            const letLabelFloatAbove: number = layer.cellSize*2
            const letLabelRotateZ: number = 90
            let labelPosition: Vector3 = new Vector3(0, entity.position.y + letLabelFloatAbove, 0)
            let labelRotation: Quaternion = Quaternion.Euler(0,0,letLabelRotateZ)
            let labelScale: Vector3 = new Vector3(1, 1, 1)

            const childEntityLabel = new Entity()
            const label = new TextShape(
                '#' + entity.entityId + ': ' +
                childEntity.getComponent(GLTFShape).src + "\n" +
                "Position: " + entity.position + "\n" +
                "Rotation: " + entityRotation.eulerAngles + "\n" +
                "Scale: " + entityScale
                )
            childEntityLabel.addComponent(label)
            childEntityLabel.setParent(childEntity)
            childEntityLabel.addComponent(new Transform({
                position: labelPosition,
                scale: labelScale,
                rotation: labelRotation
            }))
            label.fontSize = 14
            label.hTextAlign = "left"
            label.opacity = 1
            label.color = Color3.Black()

            if (logging) log(msgDEBUG +
                'Added info label at ' +
                'position: ' + labelPosition +
                ', rotation Euler: ' + labelRotation.eulerAngles +
                ' and Quaternion: ' + labelRotation +
                ', scale: ' + labelScale
            )
        }
    }

    // Position, scale and rotate parent layer entity
    layerParentEntity.addComponent(new Transform({
        position: layer.position,
        scale: layer.scale,
        rotation: layer.rotation
    }))

    if (logging) log(msgDEBUG + 'Placed layer parent entity at position ' + layer.position)
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// DCL LANDSCAPES design entity landscapes with optional random % offsets from layer cell center
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// move and rotate entities randomly within given ranges
export function landscapeLayer(layer: Layer, positionVariation: Vector3, rotationVariation: Vector3): Layer {
    let moveX: number = 0
    let moveY: number = 0 // will stay 0 as there is no point in changing the elevation
    let moveZ: number = 0
    let turnX: number = 0
    let turnY: number = 0
    let turnZ: number = 0
    // let turnW: number = 0

    let noChange: Vector3 = new Vector3(0, 0 ,0)

    if (!positionVariation.equals(noChange) || !rotationVariation.equals(noChange)) {
        if (logging) log(msgDEBUG+ 'Landscaping layer with position variation: ' + positionVariation + ' and rotation variation: ' + rotationVariation)
        for (let entity of layer.entityArray) {

            let positionChange: Vector3 = entity.position
            let rotationChange: Quaternion = entity.rotation

            // Let the magic random happen
            if (positionVariation.x > 0) {
                moveX = positionVariation.x * (Math.random() * ((layer.cellSize / 2) - 0) + 0)
                positionChange.x = entity.position.x + moveX
            }
            if (positionVariation.z > 0) {
                moveZ = positionVariation.z * (Math.random() * ((layer.cellSize / 2) - 0) + 0)
                positionChange.y = entity.position.y + moveY
            }
            if (rotationVariation.x > 0) {
                turnX = rotationVariation.x * (Math.random() * (360 - 0) + 0)
                rotationChange.eulerAngles.x = entity.rotation.eulerAngles.x + turnX
            }
            if (rotationVariation.y > 0) {
                turnY = rotationVariation.y * (Math.random() * (360 - 0) + 0)
                rotationChange.eulerAngles.y = entity.rotation.eulerAngles.y + turnY
            }
            if (rotationVariation.z > 0) {
                turnZ = rotationVariation.z * (Math.random() * (360 - 0) + 0)
                rotationChange.eulerAngles.z = entity.rotation.eulerAngles.z + turnZ
            }

            // New position and rotation
            if (logging) {
                log(msgDEBUG +
                    "Entity id: " + entity.id +
                    ", old position: " + entity.position +
                    " and new: " + positionChange +
                    ", old Euler position (Euler): " + entity.rotation.eulerAngles +
                    " and new: " + rotationChange.eulerAngles
                )
            }

            // Update layer entity
            entity.position = positionChange
            entity.rotation = rotationChange
            layer.updateEntity(entity.id, entity)
        }
    }
    return layer
}