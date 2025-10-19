# UW Research Network 3D Visualization

A 3D interactive visualization of the University of Washington research network, built with React, TypeScript, and 3d-force-graph.

## Features

- **3D Interactive Graph**: Full-screen 3D visualization of research collaborations
- **DynamoDB Integration**: Fetches data from AWS DynamoDB tables
- **Node Labels**: Displays researcher names on graph nodes
- **Interactive Controls**: Click to focus on nodes, drag to move around
- **Responsive Design**: Adapts to different screen sizes

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the project root with your AWS credentials:

```env
VITE_AWS_ACCESS_KEY_ID=your_access_key_here
VITE_AWS_SECRET_ACCESS_KEY=your_secret_key_here
VITE_AWS_REGION=us-west-2
```

### 2. AWS DynamoDB Tables

Ensure you have the following DynamoDB tables in your AWS account:

#### `researchers` table
- **Partition Key**: `researcher_id` (String)
- **Attributes**: 
  - `name` (String) - Researcher's name

#### `paper-edges` table
- **Partition Key**: `researcher_one_id` (String)
- **Sort Key**: `researcher_two_id` (String)
- **Attributes**: None required

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run the Application

```bash
pnpm dev
```

The application will be available at `http://localhost:5173`

## Usage

- **Mouse Controls**: 
  - Left click and drag to rotate the view
  - Right click and drag to pan
  - Scroll to zoom in/out
- **Node Interaction**:
  - Click on any node to focus the camera on it
  - Drag nodes to move them around (if enabled)

## Data Structure

The application expects data in the following format:

### Researchers Table
```json
{
  "researcher_id": "unique_id",
  "name": "Researcher Name"
}
```

### Paper Edges Table
```json
{
  "researcher_one_id": "researcher_id_1",
  "researcher_two_id": "researcher_id_2"
}
```

## Troubleshooting

### Common Issues

1. **"Failed to load research network data"**
   - Check your AWS credentials in the `.env` file
   - Ensure your AWS region is correct
   - Verify that the DynamoDB tables exist and have data

2. **Empty graph**
   - Check that both tables have data
   - Ensure researcher IDs in the edges table match those in the researchers table

3. **CORS errors**
   - This is a client-side application that directly connects to DynamoDB
   - Ensure your AWS credentials have the necessary DynamoDB permissions
   - Consider using AWS Cognito for production deployments

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **3d-force-graph** - 3D graph visualization
- **AWS SDK v3** - DynamoDB integration
- **Tailwind CSS** - Styling
- **Vite** - Build tool
