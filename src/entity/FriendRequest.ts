import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    Unique,
    CreateDateColumn,
    UpdateDateColumn
} from 'typeorm';
import { User } from './User';

@Entity()
@Unique(['id'])
class FriendsRequest {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    requestUserId: number;

    @Column()
    targetUserId: number;

    @Column()
    message: string;

    @Column()
    status: boolean;

    @Column()
    sendRequest: boolean;

    @Column()
    @CreateDateColumn()
    createdAt: Date;

    @Column()
    @UpdateDateColumn()
    updatedAt: Date;
};

export default FriendsRequest;